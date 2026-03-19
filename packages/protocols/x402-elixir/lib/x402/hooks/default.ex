defmodule X402.Hooks.Default do
  @moduledoc """
  Default no-op implementation of `X402.Hooks`.

  Every callback returns `{:cont, context}` so facilitator operations proceed
  unchanged.
  """

  @behaviour X402.Hooks

  alias X402.Hooks.Context

  @doc since: "0.1.0"
  @doc """
  Continues verify flow without changes.
  """
  @spec before_verify(Context.t(), X402.Hooks.metadata()) :: {:cont, Context.t()}
  def before_verify(%Context{} = context, _metadata), do: {:cont, context}

  @doc since: "0.1.0"
  @doc """
  Continues verify success handling without changes.
  """
  @spec after_verify(Context.t(), X402.Hooks.metadata()) :: {:cont, Context.t()}
  def after_verify(%Context{} = context, _metadata), do: {:cont, context}

  @doc since: "0.1.0"
  @doc """
  Continues verify failure handling without changes.
  """
  @spec on_verify_failure(Context.t(), X402.Hooks.metadata()) :: {:cont, Context.t()}
  def on_verify_failure(%Context{} = context, _metadata), do: {:cont, context}

  @doc since: "0.1.0"
  @doc """
  Continues settle flow without changes.
  """
  @spec before_settle(Context.t(), X402.Hooks.metadata()) :: {:cont, Context.t()}
  def before_settle(%Context{} = context, _metadata), do: {:cont, context}

  @doc since: "0.1.0"
  @doc """
  Continues settle success handling without changes.
  """
  @spec after_settle(Context.t(), X402.Hooks.metadata()) :: {:cont, Context.t()}
  def after_settle(%Context{} = context, _metadata), do: {:cont, context}

  @doc since: "0.1.0"
  @doc """
  Continues settle failure handling without changes.
  """
  @spec on_settle_failure(Context.t(), X402.Hooks.metadata()) :: {:cont, Context.t()}
  def on_settle_failure(%Context{} = context, _metadata), do: {:cont, context}
end
