defmodule X402.Extensions.PaymentIdentifier.CacheTest do
  use ExUnit.Case, async: true

  alias X402.Extensions.PaymentIdentifier.Cache

  defmodule ValidCache do
    @moduledoc false
    @behaviour Cache

    @impl Cache
    def get(owner, payment_id) do
      send(owner, {:cache_get, payment_id})
      :miss
    end

    @impl Cache
    def put(owner, payment_id, value) do
      send(owner, {:cache_put, payment_id, value})
      :ok
    end

    @impl Cache
    def delete(owner, payment_id) do
      send(owner, {:cache_delete, payment_id})
      :ok
    end
  end

  defmodule InvalidCache do
    @moduledoc false

    def get(_cache, _payment_id), do: :miss
  end

  test "validate_adapter/1 accepts behaviour implementations" do
    assert :ok = Cache.validate_adapter({ValidCache, self()})
  end

  test "validate_adapter/1 rejects invalid adapter values" do
    assert {:error, _message} = Cache.validate_adapter({InvalidCache, self()})
    assert {:error, _message} = Cache.validate_adapter(:invalid)
  end

  test "validate_optional_adapter/1 allows nil and valid adapters" do
    assert :ok = Cache.validate_optional_adapter(nil)
    assert :ok = Cache.validate_optional_adapter({ValidCache, self()})
  end

  test "get/2, put/3, and delete/2 dispatch to adapter module" do
    adapter = {ValidCache, self()}

    assert :miss = Cache.get(adapter, "payment-1")
    assert_receive {:cache_get, "payment-1"}

    assert :ok = Cache.put(adapter, "payment-1", :verified)
    assert_receive {:cache_put, "payment-1", :verified}

    assert :ok = Cache.delete(adapter, "payment-1")
    assert_receive {:cache_delete, "payment-1"}
  end

  test "returns invalid adapter errors for malformed adapter tuples" do
    assert {:error, :invalid_adapter} = Cache.get(:invalid, "payment-1")
    assert {:error, :invalid_adapter} = Cache.put(:invalid, "payment-1", :verified)
    assert {:error, :invalid_adapter} = Cache.delete(:invalid, "payment-1")
  end
end
