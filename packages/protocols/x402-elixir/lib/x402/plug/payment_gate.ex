if Code.ensure_loaded?(Plug) and Code.ensure_loaded?(Plug.Conn) do
  defmodule X402.Plug.PaymentGate do
    @moduledoc """
    Plug middleware that gates configured routes behind x402 payment verification.

    For matching routes, requests without an `x-payment` header receive a `402`
    response with x402 payment requirements. Requests with `x-payment` are
    decoded, verified, and settled with the configured facilitator before the
    request is allowed to continue through the plug pipeline.
    """

    @behaviour Plug

    alias X402.Extensions.PaymentIdentifier.ETSCache
    alias X402.Facilitator
    alias X402.Facilitator.Error
    alias X402.Hooks
    alias X402.Hooks.Default
    alias X402.PaymentSignature

    import Plug.Conn, only: [get_req_header: 2, halt: 1, put_resp_content_type: 2, send_resp: 3]

    @http_methods [:any, :delete, :get, :head, :options, :patch, :post, :put, :trace]
    @route_schemes ["exact", "upto"]

    @route_schema [
      method: [
        type: {:in, @http_methods},
        required: true,
        doc: "HTTP method for the route (`:any` matches all methods)."
      ],
      path: [
        type: :string,
        required: true,
        doc: "Route path, supporting exact matches and `*` globs (for example `/api/*`)."
      ],
      scheme: [
        type: {:in, @route_schemes},
        default: "exact",
        doc: "Payment scheme for the route (`exact` or `upto`)."
      ],
      price: [
        type: :string,
        required: true,
        doc: "Price for `exact` routes or maximum allowed price for `upto` routes."
      ],
      network: [
        type: :string,
        required: true,
        doc: "x402 network identifier (for example `base-sepolia`)."
      ],
      asset: [
        type: :string,
        required: true,
        doc: "Asset symbol (for example `USDC`)."
      ],
      receiver: [
        type: :string,
        required: true,
        doc: "Receiver wallet address."
      ]
    ]

    @options_schema [
      facilitator: [
        type: :any,
        default: Facilitator,
        doc: "Facilitator server pid/name used for verification and settlement."
      ],
      hooks: [
        type: {:custom, Hooks, :validate_module, []},
        default: Default,
        doc: "Lifecycle hook module implementing `X402.Hooks`."
      ],
      payment_identifier_cache: [
        type: {:or, [:atom, :pid, :any]},
        default: nil,
        doc: """
        Optional `ETSCache` server pid/name used for idempotency. When set,
        the plug performs an atomic claim (via `put_new`) on the payment proof
        hash before settling, preventing concurrent requests from double-settling
        the same payment.
        """
      ],
      routes: [
        type: {:list, {:map, @route_schema}},
        required: true,
        doc: "Route gate definitions."
      ]
    ]

    @typedoc "Configuration map produced by `init/1`."
    @type options :: %{
            facilitator: Facilitator.server(),
            hooks: module(),
            payment_identifier_cache: ETSCache.server() | nil,
            routes: [compiled_route()]
          }

    @typedoc false
    @type compiled_route :: %{
            method: atom(),
            matcher: :exact | :glob,
            path: String.t(),
            glob_regex: Regex.t() | nil,
            scheme: String.t(),
            price: String.t(),
            network: String.t(),
            asset: String.t(),
            receiver: String.t()
          }

    @doc since: "0.1.0"
    @doc """
    Validates and compiles `X402.Plug.PaymentGate` options.

    ## Options

    #{NimbleOptions.docs(@options_schema)}
    """
    @spec init(keyword()) :: options()
    def init(opts) when is_list(opts) do
      validated_opts = NimbleOptions.validate!(opts, @options_schema)

      %{
        facilitator: Keyword.fetch!(validated_opts, :facilitator),
        hooks: Keyword.fetch!(validated_opts, :hooks),
        payment_identifier_cache: Keyword.get(validated_opts, :payment_identifier_cache),
        routes:
          validated_opts
          |> Keyword.fetch!(:routes)
          |> Enum.map(&compile_route/1)
      }
    end

    @doc since: "0.1.0"
    @doc """
    Gates matching requests behind x402 payment verification.
    """
    @spec call(Plug.Conn.t(), options()) :: Plug.Conn.t()
    def call(%Plug.Conn{} = conn, %{
          facilitator: facilitator,
          hooks: hooks,
          payment_identifier_cache: payment_identifier_cache,
          routes: routes
        }) do
      request_path = normalize_path(conn.request_path)
      request_method = normalize_method(conn.method)

      case match_route(routes, request_method, request_path) do
        nil ->
          emit(:pass_through, %{method: request_method, path: request_path})
          conn

        route ->
          handle_payment_gate(
            conn,
            facilitator,
            hooks,
            payment_identifier_cache,
            route,
            request_method,
            request_path
          )
      end
    end

    @spec handle_payment_gate(
            Plug.Conn.t(),
            Facilitator.server(),
            module(),
            ETSCache.server() | nil,
            compiled_route(),
            atom(),
            String.t()
          ) :: Plug.Conn.t()
    defp handle_payment_gate(
           conn,
           facilitator,
           hooks,
           payment_identifier_cache,
           route,
           request_method,
           request_path
         ) do
      case payment_header(conn) do
        :missing ->
          emit(:payment_required, %{method: request_method, path: request_path, route: route.path})

          payment_required_response(conn, route, request_path, "")

        {:ok, header} ->
          verify_and_settle(
            conn,
            facilitator,
            hooks,
            payment_identifier_cache,
            route,
            request_method,
            request_path,
            header
          )

        {:error, reason} ->
          emit(:payment_rejected, %{
            method: request_method,
            path: request_path,
            route: route.path,
            reason: reason
          })

          payment_required_response(conn, route, request_path, rejection_error(reason))
      end
    end

    @spec verify_and_settle(
            Plug.Conn.t(),
            Facilitator.server(),
            module(),
            ETSCache.server() | nil,
            compiled_route(),
            atom(),
            String.t(),
            String.t()
          ) :: Plug.Conn.t()
    defp verify_and_settle(
           conn,
           facilitator,
           hooks,
           payment_identifier_cache,
           route,
           request_method,
           request_path,
           header
         ) do
      requirements = facilitator_requirements(route, request_path)

      # Derive a stable idempotency key from the raw payment header. Two
      # concurrent requests carrying the same proof produce the same key.
      payment_id = :crypto.hash(:sha256, header) |> Base.encode16(case: :lower)

      with {:ok, payment_payload} <- PaymentSignature.decode_and_validate(header, requirements),
           {:ok, verify_response} <-
             facilitator_verify(facilitator, payment_payload, requirements, hooks),
           :ok <- ensure_success_status(verify_response),
           :ok <- claim_payment(payment_identifier_cache, payment_id) do
        # Claim succeeded. Attempt settlement separately so we can release the
        # claim if settlement fails — otherwise a transient network error or
        # facilitator timeout would permanently block the payment ID, leaving
        # the user unable to retry with the same proof.
        settle_result =
          with {:ok, settle_response} <-
                 facilitator_settle(facilitator, payment_payload, requirements, hooks) do
            ensure_success_status(settle_response)
          end

        case settle_result do
          :ok ->
            emit(:payment_verified, %{
              method: request_method,
              path: request_path,
              route: route.path
            })

            conn

          {:error, reason} ->
            release_claim(payment_identifier_cache, payment_id)

            emit(:payment_rejected, %{
              method: request_method,
              path: request_path,
              route: route.path,
              reason: reason
            })

            payment_required_response(conn, route, request_path, rejection_error(reason))
        end
      else
        {:error, reason} ->
          emit(:payment_rejected, %{
            method: request_method,
            path: request_path,
            route: route.path,
            reason: reason
          })

          payment_required_response(conn, route, request_path, rejection_error(reason))
      end
    end

    # Atomically claims a payment ID to prevent concurrent double-settlement.
    # When no cache is configured, the check is skipped (opt-in behaviour).
    @spec claim_payment(ETSCache.server() | nil, String.t()) ::
            :ok | {:error, :already_exists}
    defp claim_payment(nil, _payment_id), do: :ok

    defp claim_payment(cache, payment_id) do
      ETSCache.put_new(cache, payment_id, :verified)
    end

    # Releases a previously claimed payment ID. Called when settlement fails
    # after a successful claim, so the caller can retry with a fresh proof.
    @spec release_claim(ETSCache.server() | nil, String.t()) :: :ok | {:error, term()}
    defp release_claim(nil, _payment_id), do: :ok
    defp release_claim(cache, payment_id), do: ETSCache.delete(cache, payment_id)

    @spec facilitator_verify(Facilitator.server(), map(), map(), module()) ::
            Facilitator.response()
    defp facilitator_verify(facilitator, payment_payload, requirements, Default) do
      Facilitator.verify(facilitator, payment_payload, requirements)
    end

    defp facilitator_verify(facilitator, payment_payload, requirements, hooks) do
      Facilitator.verify(facilitator, payment_payload, requirements, hooks)
    end

    @spec facilitator_settle(Facilitator.server(), map(), map(), module()) ::
            Facilitator.response()
    defp facilitator_settle(facilitator, payment_payload, requirements, Default) do
      Facilitator.settle(facilitator, payment_payload, requirements)
    end

    defp facilitator_settle(facilitator, payment_payload, requirements, hooks) do
      Facilitator.settle(facilitator, payment_payload, requirements, hooks)
    end

    @spec compile_route(map()) :: compiled_route()
    defp compile_route(%{} = route) do
      normalized_path = normalize_path(Map.fetch!(route, :path))
      matcher = path_matcher(normalized_path)

      %{
        method: Map.fetch!(route, :method),
        matcher: matcher,
        path: normalized_path,
        glob_regex: glob_regex(matcher, normalized_path),
        scheme: Map.get(route, :scheme, "exact"),
        price: Map.fetch!(route, :price),
        network: Map.fetch!(route, :network),
        asset: Map.fetch!(route, :asset),
        receiver: Map.fetch!(route, :receiver)
      }
    end

    @spec path_matcher(String.t()) :: :exact | :glob
    defp path_matcher(path) do
      case String.contains?(path, "*") do
        true -> :glob
        false -> :exact
      end
    end

    @spec glob_regex(:exact | :glob, String.t()) :: Regex.t() | nil
    defp glob_regex(:exact, _path), do: nil

    defp glob_regex(:glob, path) do
      ("^" <> (path |> Regex.escape() |> String.replace("\\*", ".*")) <> "$")
      |> Regex.compile!()
    end

    @spec match_route([compiled_route()], atom(), String.t()) :: compiled_route() | nil
    defp match_route(routes, request_method, request_path) do
      Enum.find(routes, fn route ->
        method_matches?(route.method, request_method) and path_matches?(route, request_path)
      end)
    end

    @spec method_matches?(atom(), atom()) :: boolean()
    defp method_matches?(:any, _request_method), do: true
    defp method_matches?(method, request_method), do: method == request_method

    @spec path_matches?(compiled_route(), String.t()) :: boolean()
    defp path_matches?(%{matcher: :exact, path: path}, request_path), do: path == request_path

    defp path_matches?(%{matcher: :glob, glob_regex: regex}, request_path),
      do: Regex.match?(regex, request_path)

    @spec payment_header(Plug.Conn.t()) ::
            :missing | {:ok, String.t()} | {:error, :invalid_payment_header}
    defp payment_header(conn) do
      case get_req_header(conn, "x-payment") do
        [] -> :missing
        [header | _] when is_binary(header) and header != "" -> {:ok, header}
        _ -> {:error, :invalid_payment_header}
      end
    end

    @spec ensure_success_status(%{status: non_neg_integer(), body: map()}) ::
            :ok | {:error, {:unexpected_facilitator_status, non_neg_integer()}}
    defp ensure_success_status(%{status: status}) when status in 200..299, do: :ok

    defp ensure_success_status(%{status: status}),
      do: {:error, {:unexpected_facilitator_status, status}}

    @spec facilitator_requirements(compiled_route(), String.t()) :: map()
    defp facilitator_requirements(route, request_path) do
      %{
        "scheme" => route.scheme,
        "network" => route.network,
        "asset" => route.asset,
        "resource" => request_path,
        "description" => "Payment required",
        "mimeType" => "application/json",
        "payTo" => route.receiver,
        "maxTimeoutSeconds" => 60,
        "extra" => %{}
      }
      |> Map.merge(scheme_pricing_entry(route.scheme, route.price))
    end

    @spec payment_required_response(Plug.Conn.t(), compiled_route(), String.t(), String.t()) ::
            Plug.Conn.t()
    defp payment_required_response(conn, route, request_path, error_message) do
      body = payment_required_body(route, request_path, error_message)

      conn
      |> put_resp_content_type("application/json")
      |> send_resp(402, body)
      |> halt()
    end

    @spec payment_required_body(compiled_route(), String.t(), String.t()) :: String.t()
    defp payment_required_body(route, request_path, error_message) do
      Jason.encode!(%{
        "x402Version" => 1,
        "accepts" => [accept_entry(route, request_path)],
        "error" => error_message
      })
    end

    @spec accept_entry(compiled_route(), String.t()) :: map()
    defp accept_entry(route, request_path) do
      %{
        "scheme" => route.scheme,
        "network" => route.network,
        "resource" => request_path,
        "description" => "Payment required",
        "mimeType" => "application/json",
        "payTo" => route.receiver,
        "maxTimeoutSeconds" => 60,
        "extra" => %{}
      }
      |> Map.merge(scheme_pricing_entry(route.scheme, route.price))
    end

    @spec scheme_pricing_entry(String.t(), String.t()) :: map()
    defp scheme_pricing_entry("upto", price), do: %{"maxPrice" => price}
    defp scheme_pricing_entry(_scheme, price), do: %{"maxAmountRequired" => price}

    @spec normalize_method(String.t()) :: atom()
    defp normalize_method("DELETE"), do: :delete
    defp normalize_method("GET"), do: :get
    defp normalize_method("HEAD"), do: :head
    defp normalize_method("OPTIONS"), do: :options
    defp normalize_method("PATCH"), do: :patch
    defp normalize_method("POST"), do: :post
    defp normalize_method("PUT"), do: :put
    defp normalize_method("TRACE"), do: :trace
    defp normalize_method(_method), do: :any

    @spec normalize_path(String.t()) :: String.t()
    defp normalize_path("/"), do: "/"
    defp normalize_path(path), do: String.trim_trailing(path, "/")

    @spec rejection_error(
            :invalid_payment_header
            | PaymentSignature.decode_and_validate_error()
            | {:unexpected_facilitator_status, non_neg_integer()}
            | Hooks.hook_error()
            | Error.t()
            | term()
          ) :: String.t()
    defp rejection_error(:invalid_payment_header), do: "invalid payment header"
    defp rejection_error(:invalid_base64), do: "invalid payment header"
    defp rejection_error(:invalid_json), do: "invalid payment header"
    defp rejection_error(:payload_too_large), do: "invalid payment header"
    defp rejection_error(:invalid_payload), do: "invalid payment payload"
    defp rejection_error(:already_exists), do: "payment already processed"
    defp rejection_error({:missing_fields, _fields}), do: "invalid payment payload"
    defp rejection_error({:invalid_upto_payment, _reason}), do: "invalid payment payload"

    defp rejection_error({:unexpected_facilitator_status, _status}),
      do: "facilitator rejected payment"

    defp rejection_error(_reason), do: "payment verification failed"

    @spec emit(:pass_through | :payment_required | :payment_verified | :payment_rejected, map()) ::
            :ok
    defp emit(event, metadata) do
      :telemetry.execute([:x402, :plug, event], %{count: 1}, metadata)
    end
  end
else
  defmodule X402.Plug.PaymentGate do
    @moduledoc """
    Plug middleware that gates configured routes behind x402 payment verification.

    This module requires the optional `:plug` dependency. Add `{:plug, "~> 1.14"}`
    to your project dependencies before using it.
    """

    @doc since: "0.1.0"
    @doc """
    Raises because Plug is not available.
    """
    @spec init(keyword()) :: no_return()
    def init(_opts) do
      raise ArgumentError, "X402.Plug.PaymentGate requires the optional :plug dependency"
    end

    @doc since: "0.1.0"
    @doc """
    Raises because Plug is not available.
    """
    @spec call(term(), map()) :: no_return()
    def call(_conn, _opts) do
      raise ArgumentError, "X402.Plug.PaymentGate requires the optional :plug dependency"
    end
  end
end
