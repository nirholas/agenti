defmodule X402.Hooks.Context do
  @moduledoc """
  Context passed between x402 lifecycle hook callbacks.

  Hook implementations can inspect and transform `:payload` and
  `:requirements` in `before_*` callbacks, set `:result` in `after_*`
  callbacks, and inspect or replace `:error` in `on_*_failure` callbacks.
  """

  @enforce_keys [:payload, :requirements]
  defstruct payload: %{}, requirements: %{}, result: nil, error: nil

  @type t :: %__MODULE__{
          payload: map(),
          requirements: map(),
          result: map() | nil,
          error: term() | nil
        }

  @doc since: "0.1.0"
  @doc """
  Builds a new lifecycle hook context.

  ## Examples

      iex> context = X402.Hooks.Context.new(%{"tx" => "0xabc"}, %{"scheme" => "exact"})
      iex> context.payload["tx"]
      "0xabc"
      iex> context.requirements["scheme"]
      "exact"
      iex> context.result
      nil
  """
  @spec new(map(), map()) :: t()
  def new(payload, requirements) when is_map(payload) and is_map(requirements) do
    %__MODULE__{
      payload: payload,
      requirements: requirements
    }
  end
end
