defmodule X402.Facilitator.HTTP do
  @moduledoc """
  HTTP transport for facilitator verify and settle requests.
  """

  alias X402.Facilitator.Error

  @transient_statuses [408, 429, 500, 502, 503, 504]
  @json_headers [{"content-type", "application/json"}, {"accept", "application/json"}]

  @type finch_name :: atom() | pid() | {:via, module(), term()}
  @type response :: {:ok, %{status: non_neg_integer(), body: map()}} | {:error, Error.t()}

  @doc """
  Performs a facilitator HTTP POST request.

  `opts` supports:

  - `:max_retries` (default: `2`)
  - `:retry_backoff_ms` (default: `100`)
  - `:receive_timeout_ms` (default: `5_000`)

  ## TLS Verification

  **REQUIRED**: TLS peer verification must be configured when starting your Finch pool.
  Failure to do so leaves your application vulnerable to MITM attacks.

  Example configuration:

      Finch.start_link(
        name: MyFinch,
        pools: %{
          default: [
            conn_opts: [
              transport_opts: [
                verify: :verify_peer,
                # Note: requires OTP 25+, see https://www.erlang.org/doc/apps/public_key/public_key.html#cacerts_get/0
                cacerts: :public_key.cacerts_get()
              ]
            ]
          ]
        }
      )

  See `secure_pool_opts/0` for a ready-to-use configuration.
  """

  @doc since: "0.1.0"
  @spec request(finch_name(), String.t(), String.t(), map(), keyword()) :: response()
  def request(finch_name, base_url, path, payload, opts \\ [])
      when is_binary(base_url) and is_binary(path) and is_map(payload) and is_list(opts) do
    with {:ok, max_retries} <- fetch_non_negative_integer(opts, :max_retries, 2),
         {:ok, retry_backoff_ms} <- fetch_non_negative_integer(opts, :retry_backoff_ms, 100),
         {:ok, receive_timeout_ms} <- fetch_non_negative_integer(opts, :receive_timeout_ms, 5_000),
         {:ok, finch_module} <- ensure_finch_module(),
         {:ok, encoded_payload} <- Jason.encode(payload) do
      ctx = %{
        finch_module: finch_module,
        finch_name: finch_name,
        url: join_url(base_url, path),
        payload: encoded_payload,
        receive_timeout_ms: receive_timeout_ms,
        retry_backoff_ms: retry_backoff_ms
      }

      do_request(ctx, 1, max_retries + 1)
    else
      {:error, %Error{} = error} ->
        {:error, error}

      {:error, reason} ->
        {:error,
         %Error{
           type: :request_setup_failed,
           reason: reason,
           retryable: false,
           attempt: 1
         }}
    end
  end

  @doc """
  Returns recommended Finch pool options with TLS peer verification enabled.

  Use these when starting your Finch pool to ensure facilitator connections
  are verified against the system CA store:

      Finch.start_link(
        name: MyFinch,
        pools: %{default: X402.Facilitator.HTTP.secure_pool_opts()}
      )

  Requires OTP 25+ for `:public_key.cacerts_get/0`.
  """
  @doc since: "0.3.2"
  @spec secure_pool_opts() :: keyword()
  def secure_pool_opts do
    [
      conn_opts: [
        transport_opts: [
          verify: :verify_peer,
          cacerts: :public_key.cacerts_get()
        ]
      ]
    ]
  end

  # Bundles retry-related context to keep function arity ≤ 8.
  defp do_request(%{} = ctx, attempt, max_attempts) do
    result = perform_request(ctx, attempt)
    maybe_retry(result, ctx, attempt, max_attempts)
  end

  defp perform_request(
         %{
           finch_module: finch_module,
           finch_name: finch_name,
           url: url,
           payload: encoded_payload,
           receive_timeout_ms: receive_timeout_ms
         },
         attempt
       ) do
    request = finch_module.build(:post, url, @json_headers, encoded_payload)
    finch_opts = [receive_timeout: receive_timeout_ms]

    response =
      try do
        finch_module.request(request, finch_name, finch_opts)
      catch
        :exit, reason -> {:error, reason}
      end

    case response do
      {:ok, %{status: status, body: body}} when status in 200..299 ->
        decode_success_response(status, body, attempt)

      {:ok, %{status: status, body: body}} when status in @transient_statuses ->
        {:error,
         %Error{
           type: :http_error,
           status: status,
           body: decode_error_body(body),
           retryable: true,
           attempt: attempt
         }}

      {:ok, %{status: status, body: body}} when is_integer(status) ->
        {:error,
         %Error{
           type: :http_error,
           status: status,
           body: decode_error_body(body),
           retryable: false,
           attempt: attempt
         }}

      {:ok, response} ->
        {:error,
         %Error{
           type: :unexpected_response,
           reason: response,
           retryable: false,
           attempt: attempt
         }}

      {:error, reason} ->
        build_transport_error(reason, attempt)
    end
  end

  defp maybe_retry(
         {:error, %Error{retryable: true}},
         %{retry_backoff_ms: backoff} = ctx,
         attempt,
         max_attempts
       )
       when attempt < max_attempts do
    :timer.sleep(backoff_ms(backoff, attempt))
    do_request(ctx, attempt + 1, max_attempts)
  end

  defp maybe_retry({:error, %Error{} = error}, _ctx, _attempt, _max_attempts) do
    {:error, error}
  end

  defp maybe_retry({:ok, _response} = ok, _ctx, _attempt, _max_attempts) do
    ok
  end

  defp decode_success_response(status, body, attempt) do
    case decode_json_body(body) do
      {:ok, decoded_body} ->
        {:ok, %{status: status, body: decoded_body}}

      {:error, reason} ->
        {:error,
         %Error{
           type: :invalid_json,
           status: status,
           body: raw_body_map(body),
           reason: reason,
           retryable: false,
           attempt: attempt
         }}
    end
  end

  defp decode_error_body(body) do
    case decode_json_body(body) do
      {:ok, decoded_body} -> decoded_body
      {:error, _reason} -> raw_body_map(body)
    end
  end

  defp decode_json_body(nil), do: {:ok, %{}}
  defp decode_json_body(""), do: {:ok, %{}}

  defp decode_json_body(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, map} when is_map(map) -> {:ok, map}
      {:ok, other} -> {:error, {:invalid_json_object, other}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp decode_json_body(other), do: {:error, {:invalid_body_type, other}}

  defp raw_body_map(nil), do: %{}
  defp raw_body_map(body) when is_binary(body), do: %{"raw_body" => body}
  defp raw_body_map(body), do: %{"raw_body" => inspect(body)}

  defp build_transport_error(reason, attempt) do
    case timeout_reason?(reason) do
      true ->
        {:error,
         %Error{
           type: :timeout,
           reason: reason,
           retryable: true,
           attempt: attempt
         }}

      false ->
        {:error,
         %Error{
           type: :transport_error,
           reason: reason,
           retryable: true,
           attempt: attempt
         }}
    end
  end

  defp timeout_reason?(:timeout), do: true
  defp timeout_reason?(%{reason: :timeout}), do: true
  defp timeout_reason?(%{reason: {:timeout, _details}}), do: true
  defp timeout_reason?(_reason), do: false

  # Full-jitter exponential backoff (capped exponential with uniform jitter).
  # Without jitter, all concurrent callers retry at the same instant —
  # thundering-herd — amplifying load on the facilitator under pressure.
  # With full jitter each caller sleeps for a random value in [1, cap], which
  # spreads retries evenly across the window.
  defp backoff_ms(retry_backoff_ms, attempt) do
    cap = retry_backoff_ms * trunc(:math.pow(2, attempt - 1))
    :rand.uniform(max(cap, 1))
  end

  defp fetch_non_negative_integer(opts, key, default) do
    value = Keyword.get(opts, key, default)

    case value do
      integer when is_integer(integer) and integer >= 0 -> {:ok, integer}
      invalid -> {:error, invalid_option_error(key, invalid)}
    end
  end

  defp invalid_option_error(key, invalid) do
    %Error{
      type: :invalid_option,
      reason: {key, invalid},
      retryable: false,
      attempt: 1
    }
  end

  defp ensure_finch_module do
    finch_module = Module.concat(["Finch"])

    case Code.ensure_loaded?(finch_module) and function_exported?(finch_module, :request, 3) and
           function_exported?(finch_module, :build, 4) do
      true ->
        {:ok, finch_module}

      false ->
        {:error, %Error{type: :finch_unavailable, reason: :missing_dependency, retryable: false}}
    end
  end

  defp join_url(base_url, path) do
    base_url = String.trim_trailing(base_url, "/")
    path = String.trim_leading(path, "/")
    base_url <> "/" <> path
  end
end
