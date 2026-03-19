defmodule X402.Extensions.SIWX.ETSStorage do
  @moduledoc """
  ETS-backed SIWX storage with TTL-based expiration.

  Records are stored in an ETS table keyed by `{address, resource}` and cleaned
  up periodically by the GenServer process.

  Reads are serialized through the GenServer to ensure consistency with
  concurrent deletes (e.g., session revocation).
  """

  use GenServer

  @behaviour X402.Extensions.SIWX.Storage

  @default_name __MODULE__
  @default_table :x402_siwx_storage
  @default_cleanup_interval_ms 60_000

  @start_link_options_schema [
    name: [
      type: :any,
      default: @default_name,
      doc: "Registered name of the ETS storage process."
    ],
    table: [
      type: :atom,
      default: @default_table,
      doc: "Named ETS table used to store SIWX access records."
    ],
    cleanup_interval_ms: [
      type: :pos_integer,
      default: @default_cleanup_interval_ms,
      doc: "Interval in milliseconds between cleanup sweeps."
    ]
  ]

  @typedoc "Storage server identifier accepted by `GenServer.call/3`."
  @type server :: GenServer.server()

  @type state :: %{
          table: atom(),
          cleanup_interval_ms: pos_integer()
        }

  @doc """
  Starts an ETS-backed SIWX storage process.

  ## Options

  #{NimbleOptions.docs(@start_link_options_schema)}
  """
  @doc since: "0.3.0"
  @spec start_link(keyword()) ::
          GenServer.on_start() | {:error, NimbleOptions.ValidationError.t()}
  def start_link(opts) when is_list(opts) do
    with {:ok, validated_opts} <- NimbleOptions.validate(opts, @start_link_options_schema) do
      name = Keyword.fetch!(validated_opts, :name)
      GenServer.start_link(__MODULE__, validated_opts, name: name)
    end
  end

  @doc """
  Returns a child specification for `X402.Extensions.SIWX.ETSStorage`.
  """
  @doc since: "0.3.0"
  @spec child_spec(keyword()) :: Supervisor.child_spec()
  def child_spec(opts) when is_list(opts) do
    %{
      id: Keyword.get(opts, :name, @default_name),
      start: {__MODULE__, :start_link, [opts]},
      type: :worker,
      restart: :permanent,
      shutdown: 5_000
    }
  end

  @doc since: "0.3.0"
  @doc """
  Fetches an access record for a wallet/resource pair from the default server.

  Reads go directly to ETS for better concurrency. Expired records return
  `{:error, :not_found}`.
  """
  @impl true
  @spec get(String.t(), String.t()) ::
          {:ok, X402.Extensions.SIWX.Storage.access_record()} | {:error, :not_found}
  def get(address, resource), do: get(@default_name, address, resource)

  @doc since: "0.3.0"
  @doc """
  Fetches an access record from a specific storage server.

  Routes through the GenServer to ensure reads are serialised with
  concurrent deletes (e.g., session revocation). A direct ETS read on a
  `:protected` table sees the table state at read-time, which may be before
  a queued-but-not-yet-processed `delete` is applied — meaning a revoked
  session can appear valid until the next cleanup sweep.
  """
  @spec get(server(), String.t(), String.t()) ::
          {:ok, X402.Extensions.SIWX.Storage.access_record()} | {:error, :not_found}
  def get(server, address, resource)
      when is_binary(address) and is_binary(resource) do
    GenServer.call(server, {:get, address, resource})
  end

  def get(_server, _address, _resource), do: {:error, :not_found}

  @doc since: "0.3.0"
  @doc """
  Stores an access record in the default storage server.
  """
  @impl true
  @spec put(String.t(), String.t(), term(), non_neg_integer()) :: :ok | {:error, term()}
  def put(address, resource, payment_proof, ttl_ms) do
    put(@default_name, address, resource, payment_proof, ttl_ms)
  end

  @doc since: "0.3.0"
  @doc """
  Stores an access record in a specific storage server.
  """
  @spec put(server(), String.t(), String.t(), term(), non_neg_integer()) :: :ok | {:error, term()}
  def put(server, address, resource, payment_proof, ttl_ms)
      when is_binary(address) and is_binary(resource) and is_integer(ttl_ms) and ttl_ms >= 0 do
    GenServer.call(server, {:put, address, resource, payment_proof, ttl_ms})
  end

  def put(_server, _address, _resource, _payment_proof, _ttl_ms), do: {:error, :invalid_arguments}

  @doc since: "0.3.0"
  @doc """
  Deletes an access record from the default storage server.
  """
  @impl true
  @spec delete(String.t(), String.t()) :: :ok
  def delete(address, resource), do: delete(@default_name, address, resource)

  @doc since: "0.3.0"
  @doc """
  Deletes an access record from a specific storage server.
  """
  @spec delete(server(), String.t(), String.t()) :: :ok
  def delete(server, address, resource) when is_binary(address) and is_binary(resource) do
    GenServer.call(server, {:delete, address, resource})
  end

  def delete(_server, _address, _resource), do: :ok

  @impl true
  @spec init(keyword()) :: {:ok, state()}
  def init(opts) do
    table = Keyword.fetch!(opts, :table)
    cleanup_interval_ms = Keyword.fetch!(opts, :cleanup_interval_ms)

    :ets.new(table, [
      :named_table,
      :set,
      :protected,
      {:read_concurrency, true}
    ])

    schedule_cleanup(cleanup_interval_ms)

    {:ok,
     %{
       table: table,
       cleanup_interval_ms: cleanup_interval_ms
     }}
  end

  @impl true
  @spec handle_call(term(), GenServer.from(), state()) ::
          {:reply, :ok | {:ok, X402.Extensions.SIWX.Storage.access_record()} | {:error, term()},
           state()}
  def handle_call({:get, address, resource}, _from, state) do
    key = {address, resource}
    now = now_ms()

    reply =
      case :ets.lookup(state.table, key) do
        [{^key, payment_proof, expires_at_ms}] when expires_at_ms > now ->
          {:ok, %{payment_proof: payment_proof, expires_at_ms: expires_at_ms}}

        _other ->
          {:error, :not_found}
      end

    {:reply, reply, state}
  end

  def handle_call({:put, address, resource, payment_proof, ttl_ms}, _from, state) do
    key = {address, resource}
    expires_at_ms = now_ms() + ttl_ms

    true = :ets.insert(state.table, {key, payment_proof, expires_at_ms})

    {:reply, :ok, state}
  end

  def handle_call({:delete, address, resource}, _from, state) do
    :ets.delete(state.table, {address, resource})
    {:reply, :ok, state}
  end

  @impl true
  @spec handle_info(:cleanup, state()) :: {:noreply, state()}
  def handle_info(:cleanup, state) do
    cleanup_expired(state.table, now_ms())
    schedule_cleanup(state.cleanup_interval_ms)
    {:noreply, state}
  end

  @spec now_ms() :: non_neg_integer()
  defp now_ms, do: System.system_time(:millisecond)

  @spec schedule_cleanup(pos_integer()) :: reference()
  defp schedule_cleanup(interval_ms), do: Process.send_after(self(), :cleanup, interval_ms)

  @spec cleanup_expired(atom(), non_neg_integer()) :: non_neg_integer()
  defp cleanup_expired(table, now) do
    :ets.select_delete(table, [
      {{{:"$1", :"$2"}, :"$3", :"$4"}, [{:"=<", :"$4", now}], [true]}
    ])
  end
end
