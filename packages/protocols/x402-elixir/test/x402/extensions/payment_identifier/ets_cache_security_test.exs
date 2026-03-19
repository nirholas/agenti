defmodule X402.Extensions.PaymentIdentifier.ETSCacheSecurityTest do
  use ExUnit.Case, async: false

  alias X402.Extensions.PaymentIdentifier.ETSCache

  test "enforces max_size limit" do
    max_size = 10
    cache = start_cache(max_size: max_size)

    # Fill the cache
    for i <- 1..max_size do
      assert :ok = ETSCache.put(cache, "payment-#{i}", :verified)
    end

    %{table: table} = :sys.get_state(cache)
    assert :ets.info(table, :size) == max_size

    # Add one more
    assert :ok = ETSCache.put(cache, "payment-#{max_size + 1}", :verified)

    # Size should still be max_size
    assert :ets.info(table, :size) == max_size
  end

  test "updating existing key does not evict another key when at max_size" do
    max_size = 10
    cache = start_cache(max_size: max_size)

    # Fill the cache
    for i <- 1..max_size do
      assert :ok = ETSCache.put(cache, "payment-#{i}", :verified)
    end

    %{table: table} = :sys.get_state(cache)
    assert :ets.info(table, :size) == max_size

    # Update an existing key
    assert :ok = ETSCache.put(cache, "payment-1", :verified)

    # Size should still be max_size
    assert :ets.info(table, :size) == max_size
    # Ensure "payment-1" is still there
    assert {:hit, :verified} = ETSCache.get(cache, "payment-1")
  end

  defp start_cache(opts) do
    name = String.to_atom("ets_cache_security_#{System.unique_integer([:positive, :monotonic])}")
    options = Keyword.merge([name: name, cleanup_interval_ms: 60_000], opts)

    start_supervised!(%{
      id: {:ets_cache, System.unique_integer([:positive, :monotonic])},
      start: {ETSCache, :start_link, [options]}
    })
  end
end
