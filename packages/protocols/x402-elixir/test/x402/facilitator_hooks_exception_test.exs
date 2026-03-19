defmodule X402.FacilitatorHooksExceptionTest do
  use ExUnit.Case, async: false

  alias X402.Facilitator

  import X402.TestHelpers

  defmodule RaisingHooks do
    @moduledoc false
    @behaviour X402.Hooks

    def before_verify(_context, _metadata) do
      raise "hook exception"
    end

    def after_verify(context, _metadata), do: {:cont, context}
    def on_verify_failure(context, _metadata), do: {:cont, context}
    def before_settle(context, _metadata), do: {:cont, context}
    def after_settle(context, _metadata), do: {:cont, context}
    def on_settle_failure(context, _metadata), do: {:cont, context}
  end

  defmodule ThrowingHooks do
    @moduledoc false
    @behaviour X402.Hooks

    def before_verify(_context, _metadata) do
      throw(:hook_throw)
    end

    def after_verify(context, _metadata), do: {:cont, context}
    def on_verify_failure(context, _metadata), do: {:cont, context}
    def before_settle(context, _metadata), do: {:cont, context}
    def after_settle(context, _metadata), do: {:cont, context}
    def on_settle_failure(context, _metadata), do: {:cont, context}
  end

  setup :setup_bypass
  setup :setup_finch

  test "verify/4 returns error on hook exception", %{
    finch: finch,
    facilitator_url: facilitator_url
  } do
    facilitator =
      start_supervised!(
        {Facilitator,
         name: String.to_atom("facilitator_#{System.unique_integer([:positive, :monotonic])}"),
         finch: finch,
         url: facilitator_url,
         hooks: RaisingHooks}
      )

    assert {:error,
            {:hook_callback_failed, :before_verify,
             {:exception, %RuntimeError{message: "hook exception"}}}} =
             Facilitator.verify(facilitator, %{}, %{})
  end

  test "verify/4 returns error on hook throw", %{
    finch: finch,
    facilitator_url: facilitator_url
  } do
    facilitator =
      start_supervised!(
        {Facilitator,
         name: String.to_atom("facilitator_#{System.unique_integer([:positive, :monotonic])}"),
         finch: finch,
         url: facilitator_url,
         hooks: ThrowingHooks}
      )

    assert {:error, {:hook_callback_failed, :before_verify, {:throw, :hook_throw}}} =
             Facilitator.verify(facilitator, %{}, %{})
  end
end
