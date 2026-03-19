:code.purge(X402.Hooks)
:code.delete(X402.Hooks)

Code.compiler_options(ignore_module_conflict: true)

Code.compile_string("""
defmodule X402.Hooks do
  @moduledoc false

  @callback before_verify(term(), term()) :: term()
  @callback after_verify(term(), term()) :: term()
  @callback on_verify_failure(term(), term()) :: term()
  @callback before_settle(term(), term()) :: term()
  @callback after_settle(term(), term()) :: term()
  @callback on_settle_failure(term(), term()) :: term()

  @required_callbacks [
    :before_verify,
    :after_verify,
    :on_verify_failure,
    :before_settle,
    :after_settle,
    :on_settle_failure
  ]

  @spec validate_module(term()) :: {:ok, module()} | {:error, String.t()}
  def validate_module(module) when is_atom(module) do
    case implementation?(module) do
      true -> {:ok, module}
      false -> {:error, "expected a module implementing X402.Hooks"}
    end
  end

  def validate_module(_invalid), do: {:error, "expected a module implementing X402.Hooks"}

  @spec implementation?(module()) :: boolean()
  defp implementation?(module) do
    Code.ensure_loaded?(module) and
      Enum.all?(@required_callbacks, &function_exported?(module, &1, 2))
  end
end
""")

Code.compiler_options(ignore_module_conflict: false)

ExUnit.start()
