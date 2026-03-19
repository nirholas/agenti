defmodule X402.Extensions.SIWX.StorageTest do
  use ExUnit.Case, async: true

  alias X402.Extensions.SIWX.Storage

  defmodule ValidStorage do
    @moduledoc false
    @behaviour Storage

    @impl true
    def get(_address, _resource), do: {:error, :not_found}

    @impl true
    def put(_address, _resource, _payment_proof, _ttl_ms), do: :ok

    @impl true
    def delete(_address, _resource), do: :ok
  end

  defmodule InvalidStorage do
    @moduledoc false
  end

  describe "validate_module/1" do
    test "returns ok for valid storage module" do
      assert Storage.validate_module(ValidStorage) == :ok
    end

    test "returns error for invalid storage modules" do
      assert Storage.validate_module(InvalidStorage) ==
               {:error, "expected a module implementing X402.Extensions.SIWX.Storage"}

      assert Storage.validate_module("not a module") ==
               {:error, "expected a module implementing X402.Extensions.SIWX.Storage"}
    end
  end
end
