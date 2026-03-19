
defmodule Benchmark do
  alias X402.Extensions.PaymentIdentifier.ETSCache

  def run do
    # Start the cache
    {:ok, _pid} = ETSCache.start_link(name: :bench_cache)

    # Populate with some data
    key = "payment-123"
    value = :verified
    ETSCache.put(:bench_cache, key, value)

    # Benchmark parameters
    concurrency = 100
    ops_per_process = 1000
    total_ops = concurrency * ops_per_process

    IO.puts("Running benchmark with #{concurrency} processes, #{ops_per_process} ops each...")

    {time_us, _} = :timer.tc(fn ->
      tasks =
        for _ <- 1..concurrency do
          Task.async(fn ->
            for _ <- 1..ops_per_process do
              ETSCache.get(:bench_cache, key)
            end
          end)
        end

      Task.await_many(tasks, :infinity)
    end)

    ops_per_sec = total_ops / (time_us / 1_000_000)
    IO.puts("Total time: #{time_us / 1000} ms")
    IO.puts("Operations per second: #{Float.round(ops_per_sec, 2)}")
  end
end

Benchmark.run()
