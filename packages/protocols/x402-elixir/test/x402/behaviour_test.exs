defmodule X402.BehaviourTest do
  use ExUnit.Case, async: true

  defmodule TestModule do
    def foo, do: :ok
    def bar(_), do: :ok
  end

  alias __MODULE__.TestModule

  describe "implements?/2" do
    test "returns true when module exports all callbacks" do
      callbacks = [{:foo, 0}, {:bar, 1}]
      assert X402.Behaviour.implements?(TestModule, callbacks)
    end

    test "returns false when module is missing a callback" do
      callbacks = [{:foo, 0}, {:missing, 1}]
      refute X402.Behaviour.implements?(TestModule, callbacks)
    end

    test "returns false when module has callback with wrong arity" do
      callbacks = [{:foo, 1}]
      refute X402.Behaviour.implements?(TestModule, callbacks)
    end

    test "returns false when module is not loaded" do
      callbacks = [{:foo, 0}]
      refute X402.Behaviour.implements?(NonExistentModule, callbacks)
    end

    test "returns true for empty callback list if module is loaded" do
      assert X402.Behaviour.implements?(TestModule, [])
    end
  end
end
