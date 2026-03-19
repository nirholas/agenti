defmodule X402.Extensions.SIWX.Verifier do
  @moduledoc """
  Behaviour for SIWX signature verification.

  Implementations verify a SIWX message signature and return whether the
  signature matches the claimed wallet address.
  """

  @typedoc "Verifier return value."
  @type verify_result :: {:ok, boolean()} | {:error, term()}

  @doc """
  Verifies a signature against a message and claimed wallet address.
  """
  @callback verify_signature(
              message :: String.t(),
              signature :: String.t(),
              address :: String.t()
            ) ::
              verify_result()

  @required_callbacks [verify_signature: 3]

  @doc since: "0.3.0"
  @doc """
  Validates that a value is a module implementing `X402.Extensions.SIWX.Verifier`.

  This function is intended for `NimbleOptions` custom validation.
  """
  @spec validate_module(term()) :: :ok | {:error, String.t()}
  def validate_module(module) when is_atom(module) do
    case implementation?(module) do
      true -> :ok
      false -> {:error, "expected a module implementing X402.Extensions.SIWX.Verifier"}
    end
  end

  def validate_module(_invalid),
    do: {:error, "expected a module implementing X402.Extensions.SIWX.Verifier"}

  @spec implementation?(module()) :: boolean()
  defp implementation?(module), do: X402.Behaviour.implements?(module, @required_callbacks)
end
