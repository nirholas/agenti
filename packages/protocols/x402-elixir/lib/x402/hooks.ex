defmodule X402.Hooks do
  @moduledoc """
  Behaviour for lifecycle hooks around facilitator verify and settle operations.

  Hooks run around each operation in this order:

  1. `before_verify/2` or `before_settle/2`
  2. `after_verify/2` or `after_settle/2` on success
  3. `on_verify_failure/2` or `on_settle_failure/2` on failure

  `before_*` callbacks can continue with `{:cont, context}` or abort with
  `{:halt, reason}`.

  `on_*_failure` callbacks can continue failure handling with `{:cont, context}`
  or recover the operation with `{:recover, result}`.
  """

  alias X402.Hooks.Context

  @typedoc "Lifecycle callback metadata passed to hooks."
  @type metadata :: %{
          required(:operation) => :verify | :settle,
          required(:endpoint) => String.t(),
          required(:hook_module) => module()
        }

  @typedoc "Hook callback identifier."
  @type callback_name ::
          :before_verify
          | :after_verify
          | :on_verify_failure
          | :before_settle
          | :after_settle
          | :on_settle_failure

  @typedoc "Return type for `before_*` callbacks."
  @type before_result :: {:cont, Context.t()} | {:halt, term()}

  @typedoc "Return type for `after_*` callbacks."
  @type after_result :: {:cont, Context.t()}

  @typedoc "Return type for `on_*_failure` callbacks."
  @type on_failure_result :: {:cont, Context.t()} | {:recover, map()}

  @typedoc """
  Hook execution error tuple returned by `X402.Facilitator`.
  """
  @type hook_error ::
          {:hook_halted, callback_name(), term()}
          | {:hook_callback_failed, callback_name(), term()}
          | {:hook_invalid_return, callback_name(), term()}

  @doc """
  Runs before a verify request is sent.
  """
  @callback before_verify(Context.t(), metadata()) :: before_result()

  @doc """
  Runs after a successful verify request.
  """
  @callback after_verify(Context.t(), metadata()) :: after_result()

  @doc """
  Runs after a failed verify request.
  """
  @callback on_verify_failure(Context.t(), metadata()) :: on_failure_result()

  @doc """
  Runs before a settle request is sent.
  """
  @callback before_settle(Context.t(), metadata()) :: before_result()

  @doc """
  Runs after a successful settle request.
  """
  @callback after_settle(Context.t(), metadata()) :: after_result()

  @doc """
  Runs after a failed settle request.
  """
  @callback on_settle_failure(Context.t(), metadata()) :: on_failure_result()

  @required_callbacks [
    before_verify: 2,
    after_verify: 2,
    on_verify_failure: 2,
    before_settle: 2,
    after_settle: 2,
    on_settle_failure: 2
  ]

  @doc since: "0.1.0"
  @doc """
  Validates that a value is a module implementing `X402.Hooks`.

  This function is designed for `NimbleOptions` custom validation.
  """
  @spec validate_module(term()) :: :ok | {:error, String.t()}
  def validate_module(module) when is_atom(module) do
    case implementation?(module) do
      true -> :ok
      false -> {:error, "expected a module implementing X402.Hooks"}
    end
  end

  def validate_module(_invalid), do: {:error, "expected a module implementing X402.Hooks"}

  @spec implementation?(module()) :: boolean()
  defp implementation?(module), do: X402.Behaviour.implements?(module, @required_callbacks)
end
