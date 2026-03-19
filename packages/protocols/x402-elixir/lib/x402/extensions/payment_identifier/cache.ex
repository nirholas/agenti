defmodule X402.Extensions.PaymentIdentifier.Cache do
  @moduledoc """
  Behaviour and adapter helpers for payment identifier idempotency caches.

  Cache adapters are configured as `{module, cache}` tuples where `module`
  implements this behaviour and `cache` is adapter-specific runtime state
  (for example, a pid or registered process name).
  """

  alias X402.Extensions.PaymentIdentifier

  @typedoc "Payment identifier cache key."
  @type key :: PaymentIdentifier.payment_id()

  @typedoc "Value stored for a given payment identifier."
  @type value :: :verified | {:rejected, term()}

  @typedoc "Adapter tuple accepted by `X402.Plug.PaymentGate`."
  @type adapter :: {module(), term()}

  @typedoc "Result returned by `get/2`."
  @type get_result :: {:hit, value()} | :miss | {:error, term()}

  @typedoc "Result returned by write/delete operations."
  @type write_result :: :ok | {:error, term()}

  @callback get(cache :: term(), key()) :: get_result()
  @callback put(cache :: term(), key(), value()) :: write_result()
  @callback delete(cache :: term(), key()) :: write_result()

  @required_callbacks [get: 2, put: 3, delete: 2]

  @doc since: "0.1.0"
  @doc """
  Validates a cache adapter tuple for `NimbleOptions` custom validation.
  """
  @spec validate_adapter(term()) :: :ok | {:error, String.t()}
  def validate_adapter({module, _cache}) when is_atom(module) do
    case implementation?(module) do
      true -> :ok
      false -> {:error, "expected a cache adapter tuple {module, cache}"}
    end
  end

  def validate_adapter(_invalid), do: {:error, "expected a cache adapter tuple {module, cache}"}

  @doc since: "0.1.0"
  @doc """
  Validates an optional cache adapter for `NimbleOptions`.

  `nil` disables idempotency caching.
  """
  @spec validate_optional_adapter(term()) :: :ok | {:error, String.t()}
  def validate_optional_adapter(nil), do: :ok
  def validate_optional_adapter(adapter), do: validate_adapter(adapter)

  @doc since: "0.1.0"
  @doc """
  Reads a cached value for a payment identifier.
  """
  @spec get(adapter(), key()) :: get_result()
  def get({module, cache}, payment_id) when is_binary(payment_id) do
    module.get(cache, payment_id)
  end

  def get(_adapter, _payment_id), do: {:error, :invalid_adapter}

  @doc since: "0.1.0"
  @doc """
  Stores a cached value for a payment identifier.
  """
  @spec put(adapter(), key(), value()) :: write_result()
  def put({module, cache}, payment_id, value) when is_binary(payment_id) do
    module.put(cache, payment_id, value)
  end

  def put(_adapter, _payment_id, _value), do: {:error, :invalid_adapter}

  @doc since: "0.1.0"
  @doc """
  Deletes a cached value for a payment identifier.
  """
  @spec delete(adapter(), key()) :: write_result()
  def delete({module, cache}, payment_id) when is_binary(payment_id) do
    module.delete(cache, payment_id)
  end

  def delete(_adapter, _payment_id), do: {:error, :invalid_adapter}

  @spec implementation?(module()) :: boolean()
  defp implementation?(module), do: X402.Behaviour.implements?(module, @required_callbacks)
end
