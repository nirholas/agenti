defmodule X402.Facilitator do
  @moduledoc """
  Stateful client for x402 facilitator verify and settle operations.
  """

  use GenServer

  alias X402.Facilitator.Error
  alias X402.Facilitator.HTTP
  alias X402.Hooks
  alias X402.Hooks.Context
  alias X402.Hooks.Default

  @default_name __MODULE__
  @default_url "https://x402.org/facilitator"

  @start_link_options_schema [
    name: [
      type: :any,
      default: @default_name,
      doc: "Registered name of the facilitator client process."
    ],
    url: [
      type: :string,
      default: @default_url,
      doc: "Facilitator base URL."
    ],
    finch: [
      type: :any,
      required: true,
      doc: "Finch process name used for HTTP requests."
    ],
    hooks: [
      type: {:custom, Hooks, :validate_module, []},
      default: Default,
      doc: "Lifecycle hook module implementing `X402.Hooks`."
    ],
    max_retries: [
      type: :non_neg_integer,
      default: 2,
      doc: "Maximum retry count for transient errors."
    ],
    retry_backoff_ms: [
      type: :non_neg_integer,
      default: 100,
      doc: "Initial retry backoff in milliseconds."
    ],
    receive_timeout_ms: [
      type: :non_neg_integer,
      default: 5_000,
      doc: "HTTP receive timeout in milliseconds."
    ]
  ]

  @typedoc "Facilitator server identifier accepted by `GenServer.call/3`."
  @type server :: GenServer.server()

  @typedoc "Facilitator response payload."
  @type operation_result :: %{status: non_neg_integer(), body: map()}

  @type response :: {:ok, operation_result()} | {:error, Error.t() | Hooks.hook_error() | term()}

  @type state :: %{
          url: String.t(),
          finch: term(),
          hooks: module(),
          max_retries: non_neg_integer(),
          retry_backoff_ms: non_neg_integer(),
          receive_timeout_ms: non_neg_integer()
        }

  @doc """
  Starts the facilitator client.

  ## Options

  #{NimbleOptions.docs(@start_link_options_schema)}
  """
  @doc since: "0.1.0"
  @spec start_link(keyword()) ::
          GenServer.on_start() | {:error, NimbleOptions.ValidationError.t()}
  def start_link(opts) when is_list(opts) do
    with {:ok, validated_opts} <- NimbleOptions.validate(opts, @start_link_options_schema) do
      name = Keyword.fetch!(validated_opts, :name)
      GenServer.start_link(__MODULE__, validated_opts, name: name)
    end
  end

  @doc """
  Returns a child specification for `X402.Facilitator`.
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

  @doc """
  Verifies a payment using the default facilitator process name.
  """
  @doc group: :verification
  @doc since: "0.1.0"
  @spec verify(map(), map()) :: response()
  def verify(payment_payload, requirements)
      when is_map(payment_payload) and is_map(requirements) do
    verify(@default_name, payment_payload, requirements)
  end

  @doc """
  Verifies a payment using the given facilitator process.
  """
  @doc group: :verification
  @doc since: "0.1.0"
  @spec verify(server(), map(), map()) :: response()
  def verify(server, payment_payload, requirements)
      when is_map(payment_payload) and is_map(requirements) do
    GenServer.call(server, {:verify, payment_payload, requirements})
  end

  @doc """
  Verifies a payment using the given facilitator process and hook module.

  This overrides the hook module configured when the facilitator process
  started.
  """
  @doc group: :verification
  @doc since: "0.1.0"
  @spec verify(server(), map(), map(), module()) :: response()
  def verify(server, payment_payload, requirements, hooks_module)
      when is_map(payment_payload) and is_map(requirements) and is_atom(hooks_module) do
    GenServer.call(server, {:verify, payment_payload, requirements, hooks_module})
  end

  @doc """
  Settles a payment using the default facilitator process name.
  """
  @doc group: :verification
  @doc since: "0.1.0"
  @spec settle(map(), map()) :: response()
  def settle(payment_payload, requirements)
      when is_map(payment_payload) and is_map(requirements) do
    settle(@default_name, payment_payload, requirements)
  end

  @doc """
  Settles a payment using the given facilitator process.
  """
  @doc group: :verification
  @doc since: "0.1.0"
  @spec settle(server(), map(), map()) :: response()
  def settle(server, payment_payload, requirements)
      when is_map(payment_payload) and is_map(requirements) do
    GenServer.call(server, {:settle, payment_payload, requirements})
  end

  @doc """
  Settles a payment using the given facilitator process and hook module.

  This overrides the hook module configured when the facilitator process
  started.
  """
  @doc group: :verification
  @doc since: "0.1.0"
  @spec settle(server(), map(), map(), module()) :: response()
  def settle(server, payment_payload, requirements, hooks_module)
      when is_map(payment_payload) and is_map(requirements) and is_atom(hooks_module) do
    GenServer.call(server, {:settle, payment_payload, requirements, hooks_module})
  end

  @impl true
  @spec init(keyword()) :: {:ok, state()}
  def init(opts) do
    state = %{
      url: Keyword.fetch!(opts, :url),
      finch: Keyword.fetch!(opts, :finch),
      hooks: Keyword.fetch!(opts, :hooks),
      max_retries: Keyword.fetch!(opts, :max_retries),
      retry_backoff_ms: Keyword.fetch!(opts, :retry_backoff_ms),
      receive_timeout_ms: Keyword.fetch!(opts, :receive_timeout_ms)
    }

    {:ok, state}
  end

  @impl true
  @spec handle_call(term(), GenServer.from(), state()) :: {:reply, response(), state()}
  def handle_call({:verify, payment_payload, requirements}, _from, state) do
    response = request_with_telemetry(state, :verify, payment_payload, requirements, state.hooks)
    {:reply, response, state}
  end

  def handle_call({:verify, payment_payload, requirements, hooks_module}, _from, state) do
    response = request_with_telemetry(state, :verify, payment_payload, requirements, hooks_module)
    {:reply, response, state}
  end

  def handle_call({:settle, payment_payload, requirements}, _from, state) do
    response = request_with_telemetry(state, :settle, payment_payload, requirements, state.hooks)
    {:reply, response, state}
  end

  def handle_call({:settle, payment_payload, requirements, hooks_module}, _from, state) do
    response = request_with_telemetry(state, :settle, payment_payload, requirements, hooks_module)
    {:reply, response, state}
  end

  defp request_with_telemetry(state, operation, payment_payload, requirements, hooks_module) do
    endpoint = operation_endpoint(operation)

    :telemetry.span(
      [:x402, :facilitator, operation],
      %{operation: operation, endpoint: endpoint},
      fn ->
        result =
          request_with_hooks(
            state,
            operation,
            payment_payload,
            requirements,
            hooks_module,
            endpoint
          )

        {result, telemetry_result_metadata(result)}
      end
    )
  end

  defp request_with_hooks(state, operation, payment_payload, requirements, hooks_module, endpoint) do
    metadata = %{operation: operation, endpoint: endpoint, hook_module: hooks_module}
    context = Context.new(payment_payload, requirements)

    case run_before_hook(hooks_module, operation, context, metadata) do
      {:cont, %Context{} = before_context} ->
        result =
          with :ok <- validate_scheme_payment(before_context.payload, before_context.requirements) do
            HTTP.request(
              state.finch,
              state.url,
              endpoint,
              %{
                payload: before_context.payload,
                requirements: before_context.requirements
              },
              max_retries: state.max_retries,
              retry_backoff_ms: state.retry_backoff_ms,
              receive_timeout_ms: state.receive_timeout_ms
            )
          end

        handle_operation_result(hooks_module, operation, before_context, result, metadata)

      {:halt, reason} ->
        {:error, reason}
    end
  end

  defp handle_operation_result(
         hooks_module,
         operation,
         %Context{} = context,
         {:ok, result},
         metadata
       )
       when is_map(result) do
    callback = after_callback(operation)
    success_context = %{context | result: result, error: nil}

    with {:ok, %Context{} = after_context} <-
           run_after_hook(hooks_module, operation, success_context, metadata) do
      finalized_result(after_context, result, callback)
    end
  end

  defp handle_operation_result(
         hooks_module,
         operation,
         %Context{} = context,
         {:error, error},
         metadata
       ) do
    failure_context = %{context | result: nil, error: error}
    run_failure_hook(hooks_module, operation, failure_context, error, metadata)
  end

  defp run_before_hook(hooks_module, operation, context, metadata) do
    callback = before_callback(operation)

    case invoke_hook(hooks_module, callback, context, metadata) do
      {:ok, {:cont, %Context{} = next_context}} ->
        {:cont, next_context}

      {:ok, {:halt, reason}} ->
        {:halt, {:hook_halted, callback, reason}}

      {:ok, invalid_return} ->
        {:halt, {:hook_invalid_return, callback, invalid_return}}

      {:error, reason} ->
        {:halt, {:hook_callback_failed, callback, reason}}
    end
  end

  defp run_after_hook(hooks_module, operation, context, metadata) do
    callback = after_callback(operation)

    case invoke_hook(hooks_module, callback, context, metadata) do
      {:ok, {:cont, %Context{} = next_context}} ->
        {:ok, next_context}

      {:ok, invalid_return} ->
        {:error, {:hook_invalid_return, callback, invalid_return}}

      {:error, reason} ->
        {:error, {:hook_callback_failed, callback, reason}}
    end
  end

  defp run_failure_hook(hooks_module, operation, context, original_error, metadata) do
    callback = failure_callback(operation)

    case invoke_hook(hooks_module, callback, context, metadata) do
      {:ok, {:cont, %Context{} = next_context}} ->
        {:error, finalized_error(next_context.error, original_error)}

      {:ok, {:recover, result}} when is_map(result) ->
        {:ok, result}

      {:ok, {:recover, invalid_result}} ->
        {:error, {:hook_invalid_return, callback, {:invalid_recovery_result, invalid_result}}}

      {:ok, invalid_return} ->
        {:error, {:hook_invalid_return, callback, invalid_return}}

      {:error, reason} ->
        {:error, {:hook_callback_failed, callback, reason}}
    end
  end

  defp finalized_result(%Context{result: nil}, default_result, _callback),
    do: {:ok, default_result}

  defp finalized_result(%Context{result: result}, _default_result, _callback) when is_map(result),
    do: {:ok, result}

  defp finalized_result(%Context{result: invalid_result}, _default_result, callback) do
    {:error, {:hook_invalid_return, callback, {:invalid_result, invalid_result}}}
  end

  defp finalized_error(nil, fallback), do: fallback
  defp finalized_error(error, _fallback), do: error

  defp invoke_hook(hooks_module, callback, context, metadata) do
    {:ok, apply(hooks_module, callback, [context, metadata])}
  rescue
    error -> {:error, {:exception, error}}
  catch
    kind, reason -> {:error, {kind, reason}}
  end

  defp validate_scheme_payment(payload, requirements) do
    case map_value(requirements, {"scheme", :scheme}) || map_value(payload, {"scheme", :scheme}) do
      "upto" ->
        validate_upto_payment(payload, requirements)

      _scheme ->
        :ok
    end
  end

  defp validate_upto_payment(payload, requirements) do
    with {:ok, max_price} <- extract_max_price(payload, requirements),
         {:ok, payment_value} <- extract_payment_value(payload) do
      ensure_not_exceeds(payment_value, max_price)
    end
  end

  defp extract_max_price(payload, requirements) do
    value =
      first_present([
        map_value(requirements, {"maxPrice", :maxPrice}),
        map_value(requirements, {"maxAmountRequired", :maxAmountRequired}),
        map_value(payload, {"maxPrice", :maxPrice}),
        map_value(payload, {"maxAmountRequired", :maxAmountRequired})
      ])

    case value do
      nil ->
        {:error, {:invalid_upto_payment, :missing_max_price}}

      max_price ->
        case parse_decimal(max_price) do
          {:ok, parsed} -> {:ok, parsed}
          :error -> {:error, {:invalid_upto_payment, :invalid_max_price}}
        end
    end
  end

  defp extract_payment_value(payload) do
    value =
      first_present([
        map_value(payload, {"value", :value}),
        nested_map_value(payload, [{"payload", :payload}, {"value", :value}]),
        nested_map_value(payload, [
          {"payload", :payload},
          {"authorization", :authorization},
          {"value", :value}
        ]),
        nested_map_value(payload, [{"authorization", :authorization}, {"value", :value}])
      ])

    case value do
      nil ->
        {:error, {:invalid_upto_payment, :missing_payment_value}}

      payment_value ->
        case parse_decimal(payment_value) do
          {:ok, parsed} -> {:ok, parsed}
          :error -> {:error, {:invalid_upto_payment, :invalid_payment_value}}
        end
    end
  end

  defp ensure_not_exceeds(payment_value, max_price) do
    case compare_decimal(payment_value, max_price) do
      :gt -> {:error, {:invalid_upto_payment, :payment_value_exceeds_max_price}}
      _comparison -> :ok
    end
  end

  defp compare_decimal({left_value, left_scale}, {right_value, right_scale})
       when left_scale == right_scale do
    compare_integer(left_value, right_value)
  end

  defp compare_decimal({left_value, left_scale}, {right_value, right_scale})
       when left_scale > right_scale do
    compare_integer(left_value, right_value * Integer.pow(10, left_scale - right_scale))
  end

  defp compare_decimal({left_value, left_scale}, {right_value, right_scale}) do
    compare_integer(left_value * Integer.pow(10, right_scale - left_scale), right_value)
  end

  defp compare_integer(left, right) when left < right, do: :lt
  defp compare_integer(left, right) when left > right, do: :gt
  defp compare_integer(_left, _right), do: :eq

  defp parse_decimal(value) when is_integer(value) and value >= 0, do: {:ok, {value, 0}}
  defp parse_decimal(value) when is_binary(value), do: parse_decimal_string(String.trim(value))
  defp parse_decimal(_value), do: :error

  defp parse_decimal_string(""), do: :error

  defp parse_decimal_string(value) do
    cond do
      Regex.match?(~r/^\d+$/, value) ->
        {:ok, {String.to_integer(value), 0}}

      Regex.match?(~r/^\d+\.\d+$/, value) ->
        [whole, fraction] = String.split(value, ".", parts: 2)
        normalized_fraction = String.trim_trailing(fraction, "0")

        case normalized_fraction do
          "" ->
            {:ok, {String.to_integer(whole), 0}}

          fraction_digits ->
            digits = whole <> fraction_digits
            {:ok, {String.to_integer(digits), String.length(fraction_digits)}}
        end

      true ->
        :error
    end
  end

  defp nested_map_value(map, [key]) when is_map(map), do: map_value(map, key)

  defp nested_map_value(map, [key | rest]) when is_map(map) do
    case map_value(map, key) do
      %{} = nested -> nested_map_value(nested, rest)
      _other -> nil
    end
  end

  defp nested_map_value(_not_map, _keys), do: nil

  defp map_value(map, {string_key, atom_key}) do
    case Map.fetch(map, string_key) do
      {:ok, value} ->
        value

      :error ->
        Map.get(map, atom_key)
    end
  end

  defp first_present(values), do: Enum.find(values, &(not is_nil(&1)))

  defp before_callback(:verify), do: :before_verify
  defp before_callback(:settle), do: :before_settle

  defp after_callback(:verify), do: :after_verify
  defp after_callback(:settle), do: :after_settle

  defp failure_callback(:verify), do: :on_verify_failure
  defp failure_callback(:settle), do: :on_settle_failure

  defp operation_endpoint(:verify), do: "/verify"
  defp operation_endpoint(:settle), do: "/settle"

  defp telemetry_result_metadata({:ok, %{status: status}}),
    do: %{status: status, success: true}

  defp telemetry_result_metadata({:error, %Error{} = error}) do
    %{
      status: error.status,
      success: false,
      error_type: error.type,
      retryable: error.retryable,
      attempt: error.attempt
    }
  end

  defp telemetry_result_metadata({:error, reason}) do
    %{
      success: false,
      error: reason
    }
  end
end
