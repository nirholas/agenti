defmodule X402.Plug.PaymentGateTest do
  use ExUnit.Case, async: false
  import Plug.Conn
  import Plug.Test

  alias X402.Plug.PaymentGate

  defmodule MockFacilitator do
    @moduledoc false
    use GenServer

    @default_verify {:ok, %{status: 200, body: %{"verified" => true}}}
    @default_settle {:ok, %{status: 200, body: %{"settled" => true}}}

    def start_link(opts) when is_list(opts) do
      GenServer.start_link(__MODULE__, opts)
    end

    @impl true
    def init(opts) do
      state = %{
        owner: Keyword.fetch!(opts, :owner),
        verify: Keyword.get(opts, :verify, @default_verify),
        settle: Keyword.get(opts, :settle, @default_settle)
      }

      {:ok, state}
    end

    @impl true
    def handle_call({:verify, payment_payload, requirements}, _from, state) do
      handle_verify_call(payment_payload, requirements, nil, state)
    end

    def handle_call({:verify, payment_payload, requirements, hooks_module}, _from, state) do
      handle_verify_call(payment_payload, requirements, hooks_module, state)
    end

    def handle_call({:settle, payment_payload, requirements}, _from, state) do
      handle_settle_call(payment_payload, requirements, nil, state)
    end

    def handle_call({:settle, payment_payload, requirements, hooks_module}, _from, state) do
      handle_settle_call(payment_payload, requirements, hooks_module, state)
    end

    defp resolve_result(result, _payment_payload, _requirements) when is_tuple(result), do: result

    defp resolve_result(result_fun, payment_payload, requirements)
         when is_function(result_fun, 2) do
      result_fun.(payment_payload, requirements)
    end

    defp handle_verify_call(payment_payload, requirements, hooks_module, state) do
      send(state.owner, {:verify_called, payment_payload, requirements, hooks_module})
      {:reply, resolve_result(state.verify, payment_payload, requirements), state}
    end

    defp handle_settle_call(payment_payload, requirements, hooks_module, state) do
      send(state.owner, {:settle_called, payment_payload, requirements, hooks_module})
      {:reply, resolve_result(state.settle, payment_payload, requirements), state}
    end
  end

  defmodule TrackingHooks do
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

  @route %{
    method: :get,
    path: "/api/resource",
    price: "0.01",
    network: "base-sepolia",
    asset: "USDC",
    receiver: "0x1111111111111111111111111111111111111111"
  }

  @upto_route Map.put(@route, :scheme, "upto")

  test "passes through non-gated routes" do
    conn = conn(:get, "/public")
    result_conn = run_request(conn, routes: [@route], facilitator: self())

    assert result_conn.status == 200
    assert result_conn.resp_body == "ok"
  end

  test "matches exact paths with normalized trailing slash" do
    conn = conn(:get, "/api/resource/")
    result_conn = run_request(conn, routes: [@route], facilitator: self())
    body = Jason.decode!(result_conn.resp_body)

    assert result_conn.status == 402
    assert body["accepts"] |> List.first() |> Map.fetch!("resource") == "/api/resource"
  end

  test "matches glob routes" do
    route = Map.put(@route, :path, "/api/*")
    conn = conn(:get, "/api/v1/items")
    result_conn = run_request(conn, routes: [route], facilitator: self())

    assert result_conn.status == 402
  end

  test "filters by method and supports :any" do
    post_route = Map.put(@route, :method, :post)
    any_route = %{post_route | method: :any, path: "/any"}

    pass_through_conn =
      run_request(conn(:get, "/api/resource"), routes: [post_route], facilitator: self())

    gated_conn = run_request(conn(:put, "/any"), routes: [any_route], facilitator: self())

    assert pass_through_conn.status == 200
    assert gated_conn.status == 402
  end

  test "returns 402 response body in required x402 format" do
    conn = conn(:get, "/api/resource")
    result_conn = run_request(conn, routes: [@route], facilitator: self())
    body = Jason.decode!(result_conn.resp_body)
    [accept] = body["accepts"]

    assert result_conn.status == 402
    assert get_resp_header(result_conn, "content-type") == ["application/json; charset=utf-8"]
    assert body["x402Version"] == 1
    assert body["error"] == ""
    assert accept["scheme"] == "exact"
    assert accept["network"] == "base-sepolia"
    assert accept["maxAmountRequired"] == "0.01"
    assert accept["resource"] == "/api/resource"
    assert accept["description"] == "Payment required"
    assert accept["mimeType"] == "application/json"
    assert accept["payTo"] == "0x1111111111111111111111111111111111111111"
    assert accept["maxTimeoutSeconds"] == 60
    assert accept["extra"] == %{}
  end

  test "returns 402 response with maxPrice for upto scheme routes" do
    conn = conn(:get, "/api/resource")
    result_conn = run_request(conn, routes: [@upto_route], facilitator: self())
    body = Jason.decode!(result_conn.resp_body)
    [accept] = body["accepts"]

    assert result_conn.status == 402
    assert accept["scheme"] == "upto"
    assert accept["maxPrice"] == "0.01"
    refute Map.has_key?(accept, "maxAmountRequired")
  end

  test "verifies and settles valid payments before pass-through" do
    facilitator = start_mock_facilitator()

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 200

    assert_receive {:verify_called, payload, requirements, hooks_module}
    assert payload["transactionHash"] == "0xabc"
    assert requirements["network"] == "base-sepolia"
    assert requirements["asset"] == "USDC"
    assert requirements["resource"] == "/api/resource"
    assert hooks_module == nil

    assert_receive {:settle_called, payload, ^requirements, ^hooks_module}
    assert payload["payerWallet"] == "0x1111111111111111111111111111111111111111"
  end

  test "passes configured hooks module to facilitator calls" do
    facilitator = start_mock_facilitator()

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())

    result_conn =
      run_request(
        conn,
        routes: [@route],
        facilitator: facilitator,
        hooks: TrackingHooks
      )

    assert result_conn.status == 200
    assert_receive {:verify_called, _payload, requirements, TrackingHooks}
    assert requirements["resource"] == "/api/resource"
    assert_receive {:settle_called, _payload, ^requirements, TrackingHooks}
  end

  test "verifies and settles valid upto payments before pass-through" do
    facilitator = start_mock_facilitator()

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_upto_payment_header("0.009"))

    result_conn = run_request(conn, routes: [@upto_route], facilitator: facilitator)

    assert result_conn.status == 200

    assert_receive {:verify_called, payload, requirements, hooks_module}
    assert payload["scheme"] == "upto"
    assert payload["value"] == "0.009"
    assert requirements["scheme"] == "upto"
    assert requirements["maxPrice"] == "0.01"
    refute Map.has_key?(requirements, "maxAmountRequired")
    assert hooks_module == nil

    assert_receive {:settle_called, _payload, ^requirements, ^hooks_module}
  end

  test "rejects upto payments when value exceeds route maxPrice" do
    facilitator = start_mock_facilitator()

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_upto_payment_header("0.02"))

    result_conn = run_request(conn, routes: [@upto_route], facilitator: facilitator)
    body = Jason.decode!(result_conn.resp_body)

    assert result_conn.status == 402
    assert body["error"] == "invalid payment payload"
    refute_received {:verify_called, _payload, _requirements, _hooks_module}
  end

  test "rejects invalid x-payment header values" do
    facilitator = start_mock_facilitator()

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", "not-valid-base64")

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)
    body = Jason.decode!(result_conn.resp_body)

    assert result_conn.status == 402
    assert body["error"] == "invalid payment header"
    refute_received {:verify_called, _payload, _requirements, _hooks_module}
  end

  test "rejects when facilitator verification fails" do
    verify_failure = fn _payment_payload, _requirements -> {:error, :verification_failed} end
    facilitator = start_mock_facilitator(verify: verify_failure)

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 402
    refute_received {:settle_called, _payload, _requirements, _hooks_module}
  end

  test "emits pass_through, payment_required, payment_verified, and payment_rejected telemetry events" do
    ok_facilitator = start_mock_facilitator()

    reject_verify = fn _payment_payload, _requirements -> {:error, :declined} end
    reject_facilitator = start_mock_facilitator(verify: reject_verify)

    handler_id = "payment-gate-#{System.unique_integer([:positive, :monotonic])}"
    parent = self()

    :ok =
      :telemetry.attach_many(
        handler_id,
        [
          [:x402, :plug, :pass_through],
          [:x402, :plug, :payment_required],
          [:x402, :plug, :payment_verified],
          [:x402, :plug, :payment_rejected]
        ],
        fn event, measurements, metadata, _config ->
          send(parent, {:telemetry_event, event, measurements, metadata})
        end,
        nil
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    run_request(conn(:get, "/public"), routes: [@route], facilitator: ok_facilitator)
    run_request(conn(:get, "/api/resource"), routes: [@route], facilitator: ok_facilitator)

    verified_conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())
      |> run_request(routes: [@route], facilitator: ok_facilitator)

    rejected_conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())
      |> run_request(routes: [@route], facilitator: reject_facilitator)

    assert verified_conn.status == 200
    assert rejected_conn.status == 402

    assert_receive {:telemetry_event, [:x402, :plug, :pass_through], %{count: 1},
                    %{path: "/public"}}

    assert_receive {:telemetry_event, [:x402, :plug, :payment_required], %{count: 1},
                    %{path: "/api/resource"}}

    assert_receive {:telemetry_event, [:x402, :plug, :payment_verified], %{count: 1},
                    %{path: "/api/resource"}}

    assert_receive {:telemetry_event, [:x402, :plug, :payment_rejected], %{count: 1},
                    %{path: "/api/resource"}}
  end

  test "init/1 raises NimbleOptions validation errors for invalid config" do
    assert_raise NimbleOptions.ValidationError, fn ->
      PaymentGate.init(facilitator: self())
    end

    assert_raise NimbleOptions.ValidationError, fn ->
      PaymentGate.init(routes: :invalid)
    end

    assert_raise NimbleOptions.ValidationError, fn ->
      PaymentGate.init(routes: [%{method: :get, path: "/api"}])
    end

    assert_raise NimbleOptions.ValidationError, fn ->
      PaymentGate.init(
        routes: [
          %{method: :foo, path: "/api", price: "1", network: "n", asset: "a", receiver: "r"}
        ]
      )
    end

    assert_raise NimbleOptions.ValidationError, fn ->
      PaymentGate.init(routes: [@route], hooks: :not_a_hook_module)
    end

    assert_raise NimbleOptions.ValidationError, fn ->
      PaymentGate.init(routes: [Map.put(@route, :scheme, "invalid")])
    end
  end

  test "rejects empty x-payment header" do
    facilitator = start_mock_facilitator()

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", "")

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)
    body = Jason.decode!(result_conn.resp_body)

    assert result_conn.status == 402
    assert body["error"] == "invalid payment header"
    refute_received {:verify_called, _payload, _requirements, _hooks_module}
  end

  test "rejects when settlement fails" do
    settle_failure = fn _payment_payload, _requirements -> {:error, :settlement_failed} end
    facilitator = start_mock_facilitator(settle: settle_failure)

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 402
    body = Jason.decode!(result_conn.resp_body)
    assert body["error"] == "payment verification failed"
  end

  test "rejects when verify returns non-200 status" do
    facilitator =
      start_mock_facilitator(verify: {:ok, %{status: 400, body: %{"error" => "invalid"}}})

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 402
    body = Jason.decode!(result_conn.resp_body)
    assert body["error"] == "facilitator rejected payment"
  end

  test "rejects when settle returns non-200 status" do
    facilitator =
      start_mock_facilitator(settle: {:ok, %{status: 500, body: %{"error" => "failed"}}})

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 402
    body = Jason.decode!(result_conn.resp_body)
    assert body["error"] == "facilitator rejected payment"
  end

  test "rejects payment with missing required fields" do
    facilitator = start_mock_facilitator()

    # Encode JSON with missing required fields (no transactionHash, no scheme)
    header =
      %{"network" => "base-sepolia"}
      |> Jason.encode!()
      |> Base.encode64()

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", header)

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 402
    body = Jason.decode!(result_conn.resp_body)
    assert body["error"] == "invalid payment payload"
    refute_received {:verify_called, _payload, _requirements, _hooks_module}
  end

  test "rejection_error for invalid_json in payment header" do
    facilitator = start_mock_facilitator()

    # Valid base64 but not valid JSON
    header = Base.encode64("not json at all")

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", header)

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 402
    body = Jason.decode!(result_conn.resp_body)
    assert body["error"] == "invalid payment header"
    refute_received {:verify_called, _payload, _requirements, _hooks_module}
  end

  test "handles multiple routes with first match winning" do
    route1 = Map.put(@route, :path, "/api/resource")
    route2 = Map.put(@route, :path, "/api/*")

    conn = conn(:get, "/api/resource")
    result_conn = run_request(conn, routes: [route1, route2], facilitator: self())

    assert result_conn.status == 402
    body = Jason.decode!(result_conn.resp_body)
    assert body["accepts"] |> List.first() |> Map.fetch!("resource") == "/api/resource"
  end

  test "normalize_method handles all HTTP methods" do
    for {method_string, method_atom} <- [
          {"DELETE", :delete},
          {"HEAD", :head},
          {"OPTIONS", :options},
          {"PATCH", :patch},
          {"POST", :post},
          {"PUT", :put},
          {"TRACE", :trace}
        ] do
      route = Map.put(@route, :method, method_atom)

      conn = Plug.Test.conn(method_string, "/api/resource")
      result_conn = run_request(conn, routes: [route], facilitator: self())
      assert result_conn.status == 402
    end
  end

  test "rejects invalid payload reason from facilitator verify" do
    facilitator = start_mock_facilitator(verify: {:error, :invalid_payload})

    conn =
      conn(:get, "/api/resource")
      |> put_req_header("x-payment", valid_payment_header())

    result_conn = run_request(conn, routes: [@route], facilitator: facilitator)

    assert result_conn.status == 402
    body = Jason.decode!(result_conn.resp_body)
    assert body["error"] == "invalid payment payload"
  end

  test "normalize_path handles root path" do
    route = Map.put(@route, :path, "/")

    conn = conn(:get, "/")
    result_conn = run_request(conn, routes: [route], facilitator: self())
    assert result_conn.status == 402
  end

  test "unknown method normalizes to :any" do
    route = Map.put(@route, :method, :any)

    # Use a custom method (non-standard)
    conn = Plug.Test.conn("PURGE", "/api/resource")
    result_conn = run_request(conn, routes: [route], facilitator: self())
    assert result_conn.status == 402
  end

  defp run_request(conn, opts) do
    conn
    |> PaymentGate.call(PaymentGate.init(opts))
    |> maybe_send_ok()
  end

  defp maybe_send_ok(%Plug.Conn{halted: true} = conn), do: conn
  defp maybe_send_ok(conn), do: Plug.Conn.send_resp(conn, 200, "ok")

  defp valid_payment_header do
    %{
      "transactionHash" => "0xabc",
      "network" => "base-sepolia",
      "scheme" => "exact",
      "payerWallet" => "0x1111111111111111111111111111111111111111"
    }
    |> Jason.encode!()
    |> Base.encode64()
  end

  defp valid_upto_payment_header(value) do
    %{
      "transactionHash" => "0xabc",
      "network" => "base-sepolia",
      "scheme" => "upto",
      "payerWallet" => "0x1111111111111111111111111111111111111111",
      "value" => value
    }
    |> Jason.encode!()
    |> Base.encode64()
  end

  defp start_mock_facilitator(opts \\ []) do
    id = {:mock_facilitator, System.unique_integer([:positive, :monotonic])}
    start_options = Keyword.put_new(opts, :owner, self())

    start_supervised!(%{
      id: id,
      start: {MockFacilitator, :start_link, [start_options]}
    })
  end
end
