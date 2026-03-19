defmodule X402.HooksTest do
  use ExUnit.Case, async: true

  alias X402.Hooks
  alias X402.Hooks.Context

  defmodule ValidHooks do
    @moduledoc false
    @behaviour X402.Hooks

    alias X402.Hooks.Context

    def before_verify(%Context{} = context, _metadata), do: {:cont, context}
    def after_verify(%Context{} = context, _metadata), do: {:cont, context}
    def on_verify_failure(%Context{} = context, _metadata), do: {:cont, context}
    def before_settle(%Context{} = context, _metadata), do: {:cont, context}
    def after_settle(%Context{} = context, _metadata), do: {:cont, context}
    def on_settle_failure(%Context{} = context, _metadata), do: {:cont, context}
  end

  defmodule InvalidHooks do
    @moduledoc false

    def before_verify(_context, _metadata), do: :ok
  end

  test "validate_module/1 accepts modules implementing X402.Hooks" do
    assert {:ok, ValidHooks} = Hooks.validate_module(ValidHooks)
  end

  test "validate_module/1 rejects modules missing required callbacks" do
    assert {:error, "expected a module implementing X402.Hooks"} =
             Hooks.validate_module(InvalidHooks)
  end

  test "validate_module/1 rejects non-module values" do
    assert {:error, "expected a module implementing X402.Hooks"} = Hooks.validate_module("bad")
  end
end
