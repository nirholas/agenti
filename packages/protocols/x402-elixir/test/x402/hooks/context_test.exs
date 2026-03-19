defmodule X402.Hooks.ContextTest do
  use ExUnit.Case, async: true

  doctest X402.Hooks.Context

  alias X402.Hooks.Context

  test "new/2 returns context with nil result and error" do
    context = Context.new(%{"tx" => "0xabc"}, %{"scheme" => "exact"})

    assert %Context{
             payload: %{"tx" => "0xabc"},
             requirements: %{"scheme" => "exact"},
             result: nil,
             error: nil
           } = context
  end
end
