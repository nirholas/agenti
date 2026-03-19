defmodule X402.TestHelpers do
  @moduledoc false

  def setup_bypass(_context) do
    bypass = Bypass.open()
    {:ok, bypass: bypass, facilitator_url: "http://localhost:#{bypass.port}"}
  end

  def setup_finch(_context) do
    finch_name = String.to_atom("finch_#{System.unique_integer([:positive, :monotonic])}")
    ExUnit.Callbacks.start_supervised!({Finch, name: finch_name})

    {:ok, finch: finch_name}
  end
end
