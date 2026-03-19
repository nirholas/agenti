defmodule X402.Hooks.DefaultTest do
  use ExUnit.Case, async: true

  alias X402.Hooks.Context
  alias X402.Hooks.Default

  @metadata %{operation: :verify, endpoint: "/verify", hook_module: Default}

  test "all callbacks return {:cont, context}" do
    context = Context.new(%{"tx" => "0xabc"}, %{"scheme" => "exact"})

    assert {:cont, ^context} = Default.before_verify(context, @metadata)
    assert {:cont, ^context} = Default.after_verify(context, @metadata)
    assert {:cont, ^context} = Default.on_verify_failure(context, @metadata)
    assert {:cont, ^context} = Default.before_settle(context, @metadata)
    assert {:cont, ^context} = Default.after_settle(context, @metadata)
    assert {:cont, ^context} = Default.on_settle_failure(context, @metadata)
  end
end
