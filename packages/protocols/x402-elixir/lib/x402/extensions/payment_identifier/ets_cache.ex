defmodule X402.Extensions.PaymentIdentifier.ETSCache do
  @moduledoc """
  ETS-backed cache adapter for payment identifier idempotency.

  Entries expire after `:ttl_ms` (default: 1 hour). Expired entries are removed
  by an internal periodic cleanup loop.
  """

  use GenServer

  @behaviour X402.Extensions.PaymentIdentifier.Cache

  alias X402.Extensions.PaymentIdentifier.Cache

  @default_name __MODULE__
  @default_ttl_ms :timer.hours(1)
  @default_cleanup_interval_ms :timer.minutes(1)
  @default_max_size 10_000

  @start_link_options_schema [
    name: [
      type: :any,
      default: @default_name,
      doc: "Registered name for the ETS cache process."
    ],
    ttl_ms: [
      type: :non_neg_integer,
      default: @default_ttl_ms,
      doc: "Time-to-live for entries in milliseconds."
    ],
    cleanup_interval_ms: [
      type: :pos_integer,
      default: @default_cleanup_interval_ms,
      doc: "How often expired entries are cleaned up, in milliseconds."
    ],
    max_size: [
      type: :pos_integer,
      default: @default_max_size,
      doc: "Maximum number of entries in the cache."
    ]
  ]

  @typedoc "Server identifier accepted by `GenServer.call/3`."
  @type server :: GenServer.server()

  @typedoc false
  @type state :: %{
          table: :ets.tid() | atom(),
          ttl_ms: non_neg_integer(),
          max_size: pos_integer(),
          cleanup_interval_ms: pos_integer(),
          cleanup_timer: reference()
        }

  @doc """
  Starts an ETS-backed idempotency cache process.

  ## Options

  #{NimbleOptions.docs(@start_link_options_schema)}
  """
  @doc since: "0.1.0"
  @spec start_link(keyword()) ::
          GenServer.on_start() | {:error, NimbleOptions.ValidationError.t()}
  def start_link(opts \\ []) when is_list(opts) do
    with {:ok, validated_opts} <- NimbleOptions.validate(opts, @start_link_options_schema) do
      name = Keyword.fetch!(validated_opts, :name)
      GenServer.start_link(__MODULE__, validated_opts, name: name)
    end
  end

  @doc """
  Returns a child specification for `X402.Extensions.PaymentIdentifier.ETSCache`.
  """
  @doc since: "0.1.0"
  @spec child_spec(keyword()) :: Supervisor.child_spec()
  def child_spec(opts) when is_list(opts) do
    validated_opts = NimbleOptions.validate!(opts, @start_link_options_schema)

    %{
      id: Keyword.fetch!(validated_opts, :name),
      start: {__MODULE__, :start_link, [validated_opts]},
      type: :worker,
      restart: :permanent,
      shutdown: 5_000
    }
  end

  @doc since: "0.1.0"
  @doc """
  Looks up a payment identifier in the cache.
  """
  @impl Cache
  @spec get(server(), Cache.key()) :: Cache.get_result()
  def get(cache, payment_id) when is_binary(payment_id) do
    if is_atom(cache) do
      try do
        case :ets.lookup(cache, payment_id) do
          [{^payment_id, value, expires_at_ms}] ->
            if expires_at_ms > now_ms() do
              {:hit, value}
            else
              :miss
            end

          [] ->
            :miss
        end
      rescue
        ArgumentError ->
          GenServer.call(cache, {:get, payment_id})
      end
    else
      GenServer.call(cache, {:get, payment_id})
    end
  end

  def get(_cache, _payment_id), do: {:error, :invalid_payment_id}

  @doc since: "0.1.0"
  @doc """
  Stores a payment identifier result in the cache.
  """
  @impl Cache
  @spec put(server(), Cache.key(), Cache.value()) :: Cache.write_result()
  def put(cache, payment_id, value) when is_binary(payment_id) do
    case valid_value?(value) do
      true -> GenServer.call(cache, {:put, payment_id, value})
      false -> {:error, :invalid_cache_value}
    end
  end

  def put(_cache, _payment_id, _value), do: {:error, :invalid_payment_id}

  @doc since: "0.4.0"
  @doc """
  Atomically inserts a payment identifier only if it does not already exist.

  Returns `:ok` if the entry was inserted, or `{:error, :already_exists}` if
  a non-expired entry for `payment_id` is already present. This is used to
  prevent concurrent requests from double-settling the same payment proof.
  """
  @spec put_new(server(), Cache.key(), Cache.value()) ::
          :ok | {:error, :already_exists | :invalid_cache_value}
  def put_new(cache, payment_id, value) when is_binary(payment_id) do
    case valid_value?(value) do
      true -> GenServer.call(cache, {:put_new, payment_id, value})
      false -> {:error, :invalid_cache_value}
    end
  end

  def put_new(_cache, _payment_id, _value), do: {:error, :invalid_payment_id}

  @doc since: "0.1.0"
  @doc """
  Deletes a payment identifier entry from the cache.
  """
  @impl Cache
  @spec delete(server(), Cache.key()) :: Cache.write_result()
  def delete(cache, payment_id) when is_binary(payment_id) do
    GenServer.call(cache, {:delete, payment_id})
  end

  def delete(_cache, _payment_id), do: {:error, :invalid_payment_id}

  @impl true
  @spec init(keyword()) :: {:ok, state()}
  def init(opts) do
    ttl_ms = Keyword.fetch!(opts, :ttl_ms)
    max_size = Keyword.fetch!(opts, :max_size)
    cleanup_interval_ms = Keyword.fetch!(opts, :cleanup_interval_ms)
    name = Keyword.get(opts, :name, __MODULE__)

    table_opts = [:set, :protected, read_concurrency: true]

    table =
      if is_atom(name) do
        :ets.new(name, [:named_table | table_opts])
      else
        :ets.new(__MODULE__, table_opts)
      end

    state = %{
      table: table,
      ttl_ms: ttl_ms,
      max_size: max_size,
      cleanup_interval_ms: cleanup_interval_ms,
      cleanup_timer: schedule_cleanup(cleanup_interval_ms)
    }

    {:ok, state}
  end

  @impl true
  @spec handle_call(term(), GenServer.from(), state()) :: {:reply, term(), state()}
  def handle_call({:get, payment_id}, _from, state) do
    now_ms = now_ms()

    reply =
      case :ets.lookup(state.table, payment_id) do
        [{^payment_id, value, expires_at_ms}] when expires_at_ms > now_ms ->
          {:hit, value}

        [{^payment_id, _value, _expires_at_ms}] ->
          :ets.delete(state.table, payment_id)
          :miss

        [] ->
          :miss
      end

    {:reply, reply, state}
  end

  def handle_call({:put, payment_id, value}, _from, state) do
    if :ets.info(state.table, :size) >= state.max_size and
         not :ets.member(state.table, payment_id) do
      # Evict the entry nearest to expiry (not ets.first, which is hash-order
      # and effectively random — an attacker could flood with unique IDs to
      # evict legitimate in-flight records and reopen replay windows).
      evict_soonest_expiry(state.table)
    end

    expires_at_ms = now_ms() + state.ttl_ms
    true = :ets.insert(state.table, {payment_id, value, expires_at_ms})
    {:reply, :ok, state}
  end

  def handle_call({:put_new, payment_id, value}, _from, state) do
    now = now_ms()
    expires_at_ms = now + state.ttl_ms

    # Delete expired entries with the same key before attempting insert_new.
    # ets.insert_new returns false for any existing entry regardless of expiry,
    # which would incorrectly block legitimate retries until the cleanup timer
    # fires (up to @default_cleanup_interval_ms = 1 minute by default).
    case :ets.lookup(state.table, payment_id) do
      [{^payment_id, _val, exp}] when exp <= now -> :ets.delete(state.table, payment_id)
      _ -> :ok
    end

    # Enforce max_size — unlike `put`, the original put_new had no capacity
    # check, allowing the cache to grow without bound under concurrent load.
    if :ets.info(state.table, :size) >= state.max_size and
         not :ets.member(state.table, payment_id) do
      evict_soonest_expiry(state.table)
    end

    # ets.insert_new is atomic — only one concurrent process wins the race.
    case :ets.insert_new(state.table, {payment_id, value, expires_at_ms}) do
      true -> {:reply, :ok, state}
      false -> {:reply, {:error, :already_exists}, state}
    end
  end

  def handle_call({:delete, payment_id}, _from, state) do
    true = :ets.delete(state.table, payment_id)
    {:reply, :ok, state}
  end

  @impl true
  @spec handle_info(:cleanup, state()) :: {:noreply, state()}
  def handle_info(:cleanup, state) do
    delete_expired_entries(state.table, now_ms())

    next_state = %{state | cleanup_timer: schedule_cleanup(state.cleanup_interval_ms)}
    {:noreply, next_state}
  end

  @spec schedule_cleanup(pos_integer()) :: reference()
  defp schedule_cleanup(cleanup_interval_ms) do
    Process.send_after(self(), :cleanup, cleanup_interval_ms)
  end

  @spec evict_soonest_expiry(:ets.tid() | atom()) :: true
  defp evict_soonest_expiry(table) do
    # Find the key whose TTL expires soonest and evict it. O(n) but eviction
    # is rare (only at max_size) and prevents cache-flooding attacks.
    case :ets.first(table) do
      :"$end_of_table" ->
        true

      first_key ->
        [{_, _, first_exp}] = :ets.lookup(table, first_key)
        {_min_exp, oldest_key} = :ets.foldl(&pick_soonest_expiry/2, {first_exp, first_key}, table)
        :ets.delete(table, oldest_key)
    end
  end

  # Accumulator for foldl — keeps track of the entry with the smallest expiry.
  # Extracted to avoid nesting depth violations in Credo strict mode.
  @spec pick_soonest_expiry(
          {term(), term(), non_neg_integer()},
          {non_neg_integer(), term()}
        ) :: {non_neg_integer(), term()}
  defp pick_soonest_expiry({key, _val, expires}, {min_exp, min_key}) do
    if expires < min_exp, do: {expires, key}, else: {min_exp, min_key}
  end

  @spec delete_expired_entries(:ets.tid() | atom(), non_neg_integer()) :: non_neg_integer()
  defp delete_expired_entries(table, now_ms) do
    :ets.select_delete(table, [{{:"$1", :"$2", :"$3"}, [{:"=<", :"$3", now_ms}], [true]}])
  end

  @spec now_ms() :: non_neg_integer()
  defp now_ms, do: System.monotonic_time(:millisecond)

  @spec valid_value?(term()) :: boolean()
  defp valid_value?(:verified), do: true
  defp valid_value?({:rejected, _reason}), do: true
  defp valid_value?(_invalid), do: false
end
