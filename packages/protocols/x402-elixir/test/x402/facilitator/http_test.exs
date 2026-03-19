defmodule X402.Facilitator.HTTPTest do
  use ExUnit.Case, async: false

  alias X402.Facilitator.Error
  alias X402.Facilitator.HTTP

  import X402.TestHelpers

  setup :maybe_setup_bypass
  setup :maybe_setup_finch

  test "request/5 returns status and decoded body on success", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"ok" => true}))
    end)

    assert {:ok, %{status: 200, body: %{"ok" => true}}} =
             HTTP.request(finch, facilitator_url, "/verify", %{"payload" => %{}}, [])
  end

  test "request/4 applies default opts", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"ok" => true}))
    end)

    assert {:ok, %{status: 200, body: %{"ok" => true}}} =
             HTTP.request(finch, facilitator_url, "/verify", %{"payload" => %{}})
  end

  test "request/5 returns non-retryable error for 400", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 400, Jason.encode!(%{"error" => "bad request"}))
    end)

    assert {:error,
            %Error{
              type: :http_error,
              status: 400,
              body: %{"error" => "bad request"},
              retryable: false
            }} =
             HTTP.request(finch, facilitator_url, "/verify", %{}, max_retries: 2)
  end

  test "request/5 returns non-retryable error for 401", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 401, Jason.encode!(%{"error" => "unauthorized"}))
    end)

    assert {:error,
            %Error{
              type: :http_error,
              status: 401,
              body: %{"error" => "unauthorized"},
              retryable: false
            }} = HTTP.request(finch, facilitator_url, "/verify", %{}, max_retries: 2)
  end

  test "request/5 retries transient errors and eventually succeeds", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    {:ok, attempts} = Agent.start_link(fn -> 0 end)

    Bypass.stub(bypass, "POST", "/verify", fn conn ->
      current_attempt = Agent.get_and_update(attempts, &{&1 + 1, &1 + 1})

      case current_attempt do
        1 ->
          Plug.Conn.resp(conn, 429, Jason.encode!(%{"error" => "rate limited"}))

        2 ->
          Plug.Conn.resp(conn, 503, Jason.encode!(%{"error" => "busy"}))

        _attempt ->
          Plug.Conn.resp(conn, 200, Jason.encode!(%{"ok" => true}))
      end
    end)

    assert {:ok, %{status: 200, body: %{"ok" => true}}} =
             HTTP.request(finch, facilitator_url, "/verify", %{},
               max_retries: 2,
               retry_backoff_ms: 1
             )

    assert Agent.get(attempts, & &1) == 3
  end

  test "request/5 returns retryable error for 500 after retries exhausted", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.stub(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 500, Jason.encode!(%{"error" => "server"}))
    end)

    assert {:error, %Error{type: :http_error, status: 500, retryable: true, attempt: 3}} =
             HTTP.request(finch, facilitator_url, "/verify", %{},
               max_retries: 2,
               retry_backoff_ms: 1
             )
  end

  test "request/5 wraps non-Error setup failures from payload encoding" do
    assert {:error, %Error{type: :request_setup_failed, retryable: false, attempt: 1}} =
             HTTP.request(:finch, "https://example.com", "/verify", %{
               "unencodable" => fn -> :not_json end
             })
  end

  test "request/5 handles invalid JSON in successful response", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, "not-json")
    end)

    assert {:error, %Error{type: :invalid_json, status: 200, retryable: false}} =
             HTTP.request(finch, facilitator_url, "/verify", %{}, [])
  end

  test "request/5 validates options" do
    assert {:error, %Error{type: :invalid_option, reason: {:max_retries, -1}}} =
             HTTP.request(:finch, "https://example.com", "/verify", %{}, max_retries: -1)
  end

  test "request/5 validates retry_backoff_ms option" do
    assert {:error, %Error{type: :invalid_option, reason: {:retry_backoff_ms, "bad"}}} =
             HTTP.request(:finch, "https://example.com", "/verify", %{}, retry_backoff_ms: "bad")
  end

  test "request/5 validates receive_timeout_ms option" do
    assert {:error, %Error{type: :invalid_option, reason: {:receive_timeout_ms, -5}}} =
             HTTP.request(:finch, "https://example.com", "/verify", %{}, receive_timeout_ms: -5)
  end

  test "request/5 handles empty body in successful response", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, "")
    end)

    assert {:ok, %{status: 200, body: %{}}} =
             HTTP.request(finch, facilitator_url, "/verify", %{}, [])
  end

  test "request/5 handles nil body in error response (transient status)", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.stub(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 503, "")
    end)

    assert {:error, %Error{type: :http_error, status: 503, body: %{}, retryable: true}} =
             HTTP.request(finch, facilitator_url, "/verify", %{}, max_retries: 0)
  end

  test "request/5 handles non-JSON error body", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 400, "plain text error")
    end)

    assert {:error,
            %Error{type: :http_error, status: 400, body: %{"raw_body" => "plain text error"}}} =
             HTTP.request(finch, facilitator_url, "/verify", %{}, [])
  end

  test "request/5 handles JSON array response as invalid json", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, "[1, 2, 3]")
    end)

    assert {:error, %Error{type: :invalid_json, status: 200, retryable: false}} =
             HTTP.request(finch, facilitator_url, "/verify", %{}, [])
  end

  test "request/5 handles all transient status codes", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    for status <- [408, 429, 502, 504] do
      Bypass.stub(bypass, "POST", "/verify", fn conn ->
        Plug.Conn.resp(conn, status, Jason.encode!(%{"error" => "transient"}))
      end)

      assert {:error, %Error{type: :http_error, status: ^status, retryable: true}} =
               HTTP.request(finch, facilitator_url, "/verify", %{},
                 max_retries: 0,
                 retry_backoff_ms: 1
               )
    end
  end

  test "request/5 normalizes URL trailing slashes", %{
    bypass: bypass,
    finch: finch,
    facilitator_url: facilitator_url
  } do
    Bypass.expect(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, 200, Jason.encode!(%{"ok" => true}))
    end)

    assert {:ok, %{status: 200}} =
             HTTP.request(finch, facilitator_url <> "/", "/verify", %{}, [])
  end

  @tag skip_bypass: true
  @tag skip_finch: true
  test "request/5 handles finch edge responses without external network" do
    with_stubbed_finch(fn ->
      Process.put(:http_test_finch_response, {:ok, %{status: 200, body: nil}})

      assert {:ok, %{status: 200, body: %{}}} =
               HTTP.request(:stub, "https://example.com", "/verify", %{}, max_retries: 0)

      non_binary_body = %{unexpected: true}
      Process.put(:http_test_finch_response, {:ok, %{status: 200, body: non_binary_body}})

      assert {:error,
              %Error{
                type: :invalid_json,
                status: 200,
                reason: {:invalid_body_type, ^non_binary_body},
                body: %{"raw_body" => "%{unexpected: true}"},
                retryable: false
              }} = HTTP.request(:stub, "https://example.com", "/verify", %{}, max_retries: 0)

      Process.put(:http_test_finch_response, {:ok, %{status: 503, body: nil}})

      assert {:error, %Error{type: :http_error, status: 503, body: %{}, retryable: true}} =
               HTTP.request(:stub, "https://example.com", "/verify", %{}, max_retries: 0)

      unexpected = %{foo: :bar}
      Process.put(:http_test_finch_response, {:ok, unexpected})

      assert {:error, %Error{type: :unexpected_response, reason: ^unexpected, retryable: false}} =
               HTTP.request(:stub, "https://example.com", "/verify", %{}, max_retries: 0)

      Process.put(:http_test_finch_response, {:error, :timeout})

      assert {:error, %Error{type: :timeout, reason: :timeout, retryable: true}} =
               HTTP.request(:stub, "https://example.com", "/verify", %{}, max_retries: 0)

      nested_timeout = %{reason: {:timeout, :read}}
      Process.put(:http_test_finch_response, {:error, nested_timeout})

      assert {:error, %Error{type: :timeout, reason: ^nested_timeout, retryable: true}} =
               HTTP.request(:stub, "https://example.com", "/verify", %{}, max_retries: 0)

      Process.put(:http_test_finch_response, {:exit, :simulated_exit})

      assert {:error, %Error{type: :transport_error, reason: :simulated_exit, retryable: true}} =
               HTTP.request(:stub, "https://example.com", "/verify", %{}, max_retries: 0)
    end)
  end

  @tag skip_bypass: true
  @tag skip_finch: true
  test "request/5 returns finch_unavailable when Finch callbacks are missing" do
    with_redefined_finch(
      """
      defmodule Finch do
        def build(_method, _url, _headers, _body), do: :stubbed_request
      end
      """,
      fn ->
        assert {:error,
                %Error{
                  type: :finch_unavailable,
                  reason: :missing_dependency,
                  retryable: false
                }} = HTTP.request(:stub, "https://example.com", "/verify", %{})
      end
    )
  end

  defp maybe_setup_bypass(%{skip_bypass: true}), do: :ok
  defp maybe_setup_bypass(context), do: setup_bypass(context)

  defp maybe_setup_finch(%{skip_finch: true}), do: :ok
  defp maybe_setup_finch(context), do: setup_finch(context)

  defp with_stubbed_finch(fun) when is_function(fun, 0) do
    with_redefined_finch(
      """
      defmodule Finch do
        def build(method, url, headers, body), do: %{method: method, url: url, headers: headers, body: body}

        def request(request, finch_name, opts) do
          case Process.get(:http_test_finch_response) do
            {:exit, reason} -> exit(reason)
            {:fun, response_fun} when is_function(response_fun, 3) -> response_fun.(request, finch_name, opts)
            response -> response
          end
        end
      end
      """,
      fn ->
        try do
          fun.()
        after
          Process.delete(:http_test_finch_response)
        end
      end
    )
  end

  defp with_redefined_finch(module_source, fun)
       when is_binary(module_source) and is_function(fun, 0) do
    {Finch, original_binary, original_path} = :code.get_object_code(Finch)
    original_conflict_setting = Code.get_compiler_option(:ignore_module_conflict)

    Code.put_compiler_option(:ignore_module_conflict, true)

    try do
      Code.compile_string(module_source)
      fun.()
    after
      :code.load_binary(Finch, original_path, original_binary)
      Code.put_compiler_option(:ignore_module_conflict, original_conflict_setting)
    end
  end
end
