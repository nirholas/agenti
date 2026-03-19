defmodule X402.Behaviour do
  @moduledoc """
  Utilities for working with Elixir behaviours and callback implementations.
  """

  @doc since: "0.1.0"
  @doc """
  Checks if a module implements a set of callbacks.

  The `callbacks` argument should be a list of `{name, arity}` tuples.
  """
  @spec implements?(module(), [{atom(), integer()}]) :: boolean()
  def implements?(module, callbacks) do
    Code.ensure_loaded?(module) and
      Enum.all?(callbacks, fn {name, arity} ->
        function_exported?(module, name, arity)
      end)
  end
end
