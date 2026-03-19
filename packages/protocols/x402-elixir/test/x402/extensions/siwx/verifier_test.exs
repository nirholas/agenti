defmodule X402.Extensions.SIWX.VerifierTest do
  use ExUnit.Case, async: true

  alias X402.Extensions.SIWX.Verifier

  defmodule ValidVerifier do
    @moduledoc false
    @behaviour Verifier

    @impl true
    def verify_signature(_message, _signature, _address), do: {:ok, true}
  end

  defmodule InvalidVerifier do
    @moduledoc false
  end

  describe "validate_module/1" do
    test "returns ok for valid verifier module" do
      assert Verifier.validate_module(ValidVerifier) == :ok
    end

    test "returns error for invalid verifier module" do
      assert Verifier.validate_module(InvalidVerifier) ==
               {:error, "expected a module implementing X402.Extensions.SIWX.Verifier"}

      assert Verifier.validate_module("not a module") ==
               {:error, "expected a module implementing X402.Extensions.SIWX.Verifier"}
    end
  end
end
