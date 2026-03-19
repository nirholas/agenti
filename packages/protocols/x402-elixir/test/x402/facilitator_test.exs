defmodule X402.FacilitatorTest do
  use ExUnit.Case, async: false

  alias X402.Facilitator
  alias X402.Facilitator.Error
  alias X402.Hooks.Context

  import X402.TestHelpers

  defmodule MutatingHooks do
    @moduledoc false
    @behaviour X402.Hooks

    alias X402.Hooks.Context

    def before_verify(%Context{} = context, _metadata) do
      {:cont,
       %Context{
         context
         | payload: Map.put(context.payload, "beforeVerify", true),
           requirements: Map.put(context.requirements, "beforeVerify", true)
       }}
    end

    def after_verify(%Context{} = context, _metadata) do
      body = Map.fetch!(context.result, :body)
      result = Map.put(context.result, :body, Map.put(body, "afterVerify", true))
      {:cont, %Context{context | result: result}}
    end

    def on_verify_failure(%Context{} = context, _metadata), do: {:cont, context}

    def before_settle(%Context{} = context, _metadata) do
      {:cont,
       %Context{
         context
         | payload: Map.put(context.payload, "beforeSettle", true),
           requirements: Map.put(context.requirements, "beforeSettle", true)
       }}
    end

    def after_settle(%Context{} = context, _metadata) do
      body = Map.fetch!(context.result, :body)
      result = Map.put(context.result, :body, Map.put(body, "afterSettle", true))
      {:cont, %Context{context | result: result}}
    end

    def on_settle_failure(%Context{} = context, _metadata), do: {:cont, context}
  end

  defmodule VerifyHaltHooks do
    @moduledoc false
    @behaviour X402.Hooks

    alias X402.Hooks.Context

    def before_verify(%Context{} = _context, _metadata), do: {:halt, :verify_halted}
    def after_verify(%Context{} = context, _metadata), do: {:cont, context}
    def on_verify_failure(%Context{} = context, _metadata), do: {:cont, context}
    def before_settle(%Context{} = context, _metadata), do: {:cont, context}
    def after_settle(%Context{} = context, _metadata), do: {:cont, context}
    def on_settle_failure(%Context{} = context, _metadata), do: {:cont, context}
  end

  defmodule VerifyRecoverHooks do
    @moduledoc false
    @behaviour X402.Hooks

    alias X402.Hooks.Context

    def before_verify(%Context{} = context, _metadata), do: {:cont, context}
    def after_verify(%Context{} = context, _metadata), do: {:cont, context}

    def on_verify_failure(%Context{} = _context, _metadata) do
      {:recover, %{status: 200, body: %{"recovered" => true}}}
    end

    def before_settle(%Context{} = context, _metadata), do: {:cont, context}
    def after_settle(%Context{} = context, _metadata), do: {:cont, context}
    def on_settle_failure(%Context{} = context, _metadata), do: {:cont, context}
  end

  defmodule SettleRecoverHooks do
    @moduledoc false
    @behaviour X402.Hooks

    alias X402.Hooks.Context

    def before_verify(%Context{} = context, _metadata), do: {:cont, context}
    def after_verify(%Context{} = context, _metadata), do: {:cont, context}
    def on_verify_failure(%Context{} = context, _metadata), do: {:cont, context}
    def before_settle(%Context{} = context, _metadata), do: {:cont, context}
    def after_settle(%Context{} = context, _metadata), do: {:cont, context}

    def on_settle_failure(%Context{} = _context, _metadata) do
      {:recover, %{status: 200, body: %{"settled" => "recovered"}}}
    end
  end

  defmodule InvalidAfterVerifyHooks do
    @moduledoc false
    @behaviour X402.Hooks

    alias X402.Hooks.Context

    def before_verify(%Context{} = context, _metadata), do: {:cont, context}
    def after_verify(%Context{} = _context, _metadata), do: :invalid_return
    def on_verify_failure(%Context{} = context, _metadata), do: {:cont, context}
    def before_settle(%Context{} = context, _metadata), do: {:cont, context}
    def after_settle(%Context{} = context, _metadata), do: {:cont, context}
    def on_settle_failure(%Context{} = context, _metadata), do: {:cont, context}
  end

  defmodule UptoAdjustingHooks do
    @moduledoc false
    @behaviour X402.Hooks

    alias X402.Hooks.Context

    def before_verify(%Context{} = context, _metadata) do
      {:cont, %Context{context | payload: Map.put(context.payload, "value", "9")}}
    end

    def after_verify(%Context{} = context, _metadata), do: {:cont, context}
    def on_verify_failure(%Context{} = context, _metadata), do: {:cont, context}

    def before_settle(%Context{} = context, _metadata) do
      {:cont, %Context{context | payload: Map.put(context.payload, "value", "9")}}
    end

    def after_settle(%Context{} = context, _metadata), do: {:cont, context}
    def on_settle_failure(%Context{} = context, _metadata), do: {:cont, context}
  end

  setup :setup_bypass
  setup :setup_finch

  test "verify/3 posts payload and requirements to /verify", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    payment_payload = %{"signature" => "abc"}
    requirements = %{"scheme" => "exact"}

    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)

      assert %{"payload" => ^payment_payload, "requirements" => ^requirements} =
               Jason.decode!(body)

      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator, name: unique_name("facilitator"), finch: finch, url: facilitator_url}
      )

    assert {:ok, %{status: 200, body: %{"verified" => true}}} =
             Facilitator.verify(facilitator, payment_payload, requirements)
  end

  test "settle/3 posts payload and requirements to /settle", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    payment_payload = %{"tx" => "0xdeadbeef"}
    requirements = %{"network" => "eip155:8453"}

    Bypass.expect(bypass, "POST", "/settle", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)

      assert %{"payload" => ^payment_payload, "requirements" => ^requirements} =
               Jason.decode!(body)

      Plug.Conn.resp(conn, 200, Jason.encode!(%{"settled" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator, name: unique_name("facilitator"), finch: finch, url: facilitator_url}
      )

    assert {:ok, %{status: 200, body: %{"settled" => true}}} =
             Facilitator.settle(facilitator, payment_payload, requirements)
  end

  test "before_verify and after_verify hooks can mutate verify flow", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)

      assert %{
               "payload" => %{"beforeVerify" => true},
               "requirements" => %{"beforeVerify" => true}
             } = Jason.decode!(body)

      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: MutatingHooks}
      )

    assert {:ok, %{status: 200, body: %{"verified" => true, "afterVerify" => true}}} =
             Facilitator.verify(facilitator, %{}, %{})
  end

  test "before_settle and after_settle hooks can mutate settle flow", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/settle", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)

      assert %{
               "payload" => %{"beforeSettle" => true},
               "requirements" => %{"beforeSettle" => true}
             } = Jason.decode!(body)

      Plug.Conn.resp(conn, 200, Jason.encode!(%{"settled" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: MutatingHooks}
      )

    assert {:ok, %{status: 200, body: %{"settled" => true, "afterSettle" => true}}} =
             Facilitator.settle(facilitator, %{}, %{})
  end

  test "before_verify can halt the operation", %{
    finch: finch,
    facilitator_url: facilitator_url
  } do
    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: VerifyHaltHooks}
      )

    assert {:error, {:hook_halted, :before_verify, :verify_halted}} =
             Facilitator.verify(facilitator, %{}, %{})
  end

  test "on_verify_failure can recover failed verification", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 500, Jason.encode!(%{"error" => "retry me"}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: VerifyRecoverHooks}
      )

    assert {:ok, %{status: 200, body: %{"recovered" => true}}} =
             Facilitator.verify(facilitator, %{}, %{})
  end

  test "on_settle_failure can recover failed settlement", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/settle", fn conn ->
      Plug.Conn.resp(conn, 500, Jason.encode!(%{"error" => "retry me"}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: SettleRecoverHooks}
      )

    assert {:ok, %{status: 200, body: %{"settled" => "recovered"}}} =
             Facilitator.settle(facilitator, %{}, %{})
  end

  test "verify/4 and settle/4 override the configured hook module", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert %{"payload" => %{"beforeVerify" => true}} = Jason.decode!(body)
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    Bypass.expect(bypass, "POST", "/settle", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert %{"payload" => %{"beforeSettle" => true}} = Jason.decode!(body)
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"settled" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: X402.Hooks.Default}
      )

    assert {:ok, %{status: 200, body: %{"verified" => true, "afterVerify" => true}}} =
             Facilitator.verify(facilitator, %{}, %{}, MutatingHooks)

    assert {:ok, %{status: 200, body: %{"settled" => true, "afterSettle" => true}}} =
             Facilitator.settle(facilitator, %{}, %{}, MutatingHooks)
  end

  test "returns hook_invalid_return when hook callback returns invalid tuple", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: InvalidAfterVerifyHooks}
      )

    assert {:error, {:hook_invalid_return, :after_verify, :invalid_return}} =
             Facilitator.verify(facilitator, %{}, %{})
  end

  test "verify/2 and settle/2 use default registered name", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    Bypass.expect(bypass, "POST", "/settle", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"settled" => true}))
    end)

    start_supervised!({Facilitator, finch: finch, url: facilitator_url})

    assert {:ok, %{status: 200, body: %{"verified" => true}}} =
             Facilitator.verify(%{"p" => 1}, %{"r" => 1})

    assert {:ok, %{status: 200, body: %{"settled" => true}}} =
             Facilitator.settle(%{"p" => 2}, %{"r" => 2})
  end

  test "returns structured errors from transport", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 400, Jason.encode!(%{"error" => "bad request"}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator, name: unique_name("facilitator"), finch: finch, url: facilitator_url}
      )

    assert {:error, %Error{type: :http_error, status: 400, retryable: false}} =
             Facilitator.verify(facilitator, %{}, %{})
  end

  test "verify/3 rejects upto payments above maxPrice before HTTP request", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    parent = self()

    Bypass.stub(bypass, "POST", "/verify", fn conn ->
      send(parent, :verify_http_called)
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator, name: unique_name("facilitator"), finch: finch, url: facilitator_url}
      )

    assert {:error, {:invalid_upto_payment, :payment_value_exceeds_max_price}} =
             Facilitator.verify(
               facilitator,
               %{"value" => "11"},
               %{"scheme" => "upto", "maxPrice" => "10"}
             )

    refute_receive :verify_http_called
  end

  test "settle/3 rejects upto payments above maxPrice before HTTP request", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    parent = self()

    Bypass.stub(bypass, "POST", "/settle", fn conn ->
      send(parent, :settle_http_called)
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"settled" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator, name: unique_name("facilitator"), finch: finch, url: facilitator_url}
      )

    assert {:error, {:invalid_upto_payment, :payment_value_exceeds_max_price}} =
             Facilitator.settle(
               facilitator,
               %{"value" => "11"},
               %{"scheme" => "upto", "maxPrice" => "10"}
             )

    refute_receive :settle_http_called
  end

  test "upto validation respects before hooks for verify and settle", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert %{"payload" => %{"value" => "9"}} = Jason.decode!(body)
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    Bypass.expect(bypass, "POST", "/settle", fn conn ->
      assert {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert %{"payload" => %{"value" => "9"}} = Jason.decode!(body)
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"settled" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator,
         name: unique_name("facilitator"),
         finch: finch,
         url: facilitator_url,
         hooks: UptoAdjustingHooks}
      )

    assert {:ok, %{status: 200, body: %{"verified" => true}}} =
             Facilitator.verify(
               facilitator,
               %{"value" => "11"},
               %{"scheme" => "upto", "maxPrice" => "10"}
             )

    assert {:ok, %{status: 200, body: %{"settled" => true}}} =
             Facilitator.settle(
               facilitator,
               %{"value" => "11"},
               %{"scheme" => "upto", "maxPrice" => "10"}
             )
  end

  test "emits telemetry span events", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    parent = self()
    handler_id = "facilitator-span-#{System.unique_integer([:positive, :monotonic])}"

    :ok =
      :telemetry.attach_many(
        handler_id,
        [[:x402, :facilitator, :verify, :start], [:x402, :facilitator, :verify, :stop]],
        fn event, measurements, metadata, _config ->
          send(parent, {:telemetry, event, measurements, metadata})
        end,
        nil
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"verified" => true}))
    end)

    facilitator =
      start_supervised!(
        {Facilitator, name: unique_name("facilitator"), finch: finch, url: facilitator_url}
      )

    assert {:ok, %{status: 200, body: %{"verified" => true}}} =
             Facilitator.verify(facilitator, %{}, %{})

    assert_receive {:telemetry, [:x402, :facilitator, :verify, :start], _measurements,
                    %{operation: :verify, endpoint: "/verify"}}

    assert_receive {:telemetry, [:x402, :facilitator, :verify, :stop], measurements,
                    %{success: true, status: 200}}

    assert %{duration: duration} = measurements
    assert is_integer(duration)
  end

  test "start_link validates required options" do
    assert {:error, %NimbleOptions.ValidationError{}} = Facilitator.start_link([])

    assert {:error, %NimbleOptions.ValidationError{}} =
             Facilitator.start_link(finch: :finch, max_retries: -1)

    assert {:error, %NimbleOptions.ValidationError{}} =
             Facilitator.start_link(finch: :finch, hooks: :not_a_hook_module)
  end

  test "hook context struct includes payload and requirements" do
    assert %Context{payload: %{a: 1}, requirements: %{b: 2}, result: nil, error: nil} =
             Context.new(%{a: 1}, %{b: 2})
  end

  defp unique_name(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive, :monotonic])}")
  end
end
