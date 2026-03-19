defmodule X402.Extensions.SIWX do
  @moduledoc """
  Encodes and decodes SIWX messages and `SIGN-IN-WITH-X` header values.

  SIWX messages follow the SIWE (EIP-4361) textual format and use CAIP-2
  chain identifiers for EVM networks (`eip155:*`).
  """

  alias X402.Wallet

  @required_message_fields [
    :domain,
    :address,
    :statement,
    :uri,
    :version,
    :chain_id,
    :nonce,
    :issued_at,
    :expiration_time
  ]

  @siwe_version "1"
  @domain_suffix " wants you to sign in with your Ethereum account:"
  @nonce_regex ~r/^[A-Za-z0-9]{8,}$/

  @typedoc "SIWX message payload fields."
  @type message_payload :: %{
          required(:domain) => String.t(),
          required(:address) => String.t(),
          required(:statement) => String.t(),
          required(:uri) => String.t(),
          required(:version) => String.t(),
          required(:chain_id) => String.t(),
          required(:nonce) => String.t(),
          required(:issued_at) => String.t(),
          required(:expiration_time) => String.t()
        }

  @type encode_error :: :invalid_payload | {:missing_fields, [atom()]} | {:invalid_field, atom()}
  @type decode_error :: :invalid_message | {:invalid_field, atom()}
  @type header_encode_error :: :invalid_payload | :invalid_json

  @type header_decode_error :: :invalid_base64 | :invalid_json | :invalid_payload

  @doc since: "0.3.0", group: :headers
  @doc """
  Returns the canonical SIWX header name.

  ## Examples

      iex> X402.Extensions.SIWX.header_name()
      "SIGN-IN-WITH-X"
  """
  @spec header_name() :: String.t()
  def header_name, do: "SIGN-IN-WITH-X"

  @doc since: "0.3.0"
  @doc """
  Encodes a SIWX payload into an EIP-4361 message.

  `:chain_id` accepts either `"eip155:<id>"` or a positive integer.

  ## Examples

      iex> payload = %{
      ...>   domain: "example.com",
      ...>   address: "0x1111111111111111111111111111111111111111",
      ...>   statement: "Access purchased content",
      ...>   uri: "https://example.com/protected",
      ...>   version: "1",
      ...>   chain_id: "eip155:1",
      ...>   nonce: "abc12345",
      ...>   issued_at: "2026-02-16T12:00:00Z",
      ...>   expiration_time: "2026-02-16T13:00:00Z"
      ...> }
      iex> {:ok, message} = X402.Extensions.SIWX.encode(payload)
      iex> is_binary(message)
      true
  """
  @spec encode(map()) :: {:ok, String.t()} | {:error, encode_error()}
  def encode(payload) when is_map(payload) do
    with {:ok, normalized} <- normalize_payload(payload) do
      {:ok,
       [
         "#{normalized.domain}#{@domain_suffix}",
         normalized.address,
         "",
         normalized.statement,
         "",
         "URI: #{normalized.uri}",
         "Version: #{normalized.version}",
         "Chain ID: #{normalized.chain_ref}",
         "Nonce: #{normalized.nonce}",
         "Issued At: #{normalized.issued_at}",
         "Expiration Time: #{normalized.expiration_time}"
       ]
       |> Enum.join("\n")}
    end
  end

  def encode(_payload), do: {:error, :invalid_payload}

  @doc since: "0.3.0"
  @doc """
  Decodes an EIP-4361 SIWX message into payload fields.

  ## Examples

      iex> payload = %{
      ...>   domain: "example.com",
      ...>   address: "0x1111111111111111111111111111111111111111",
      ...>   statement: "Access purchased content",
      ...>   uri: "https://example.com/protected",
      ...>   version: "1",
      ...>   chain_id: "eip155:1",
      ...>   nonce: "abc12345",
      ...>   issued_at: "2026-02-16T12:00:00Z",
      ...>   expiration_time: "2026-02-16T13:00:00Z"
      ...> }
      iex> {:ok, message} = X402.Extensions.SIWX.encode(payload)
      iex> X402.Extensions.SIWX.decode(message)
      {:ok, payload}
  """
  @spec decode(String.t()) :: {:ok, message_payload()} | {:error, decode_error()}
  def decode(message) when is_binary(message) do
    with {:ok, payload} <- parse_message(message),
         {:ok, normalized} <- normalize_payload(payload) do
      {:ok,
       %{
         domain: normalized.domain,
         address: normalized.address,
         statement: normalized.statement,
         uri: normalized.uri,
         version: normalized.version,
         chain_id: normalized.chain_id,
         nonce: normalized.nonce,
         issued_at: normalized.issued_at,
         expiration_time: normalized.expiration_time
       }}
    else
      {:error, {:missing_fields, _missing}} -> {:error, :invalid_message}
      {:error, :invalid_payload} -> {:error, :invalid_message}
      {:error, reason} -> {:error, reason}
    end
  end

  def decode(_message), do: {:error, :invalid_message}

  @doc since: "0.3.0", group: :headers
  @doc """
  Encodes a SIWX header payload with `message` and `signature` fields.

  ## Examples

      iex> {:ok, header} = X402.Extensions.SIWX.encode_header(%{message: "hello", signature: "0xabc"})
      iex> {:ok, decoded} = X402.Extensions.SIWX.decode_header(header)
      iex> decoded["message"]
      "hello"
  """
  @spec encode_header(map()) :: {:ok, String.t()} | {:error, header_encode_error()}
  def encode_header(payload) when is_map(payload) do
    with {:ok, message} <- fetch_non_empty_binary(payload, :message),
         {:ok, signature} <- fetch_non_empty_binary(payload, :signature),
         {:ok, json} <- Jason.encode(%{"message" => message, "signature" => signature}) do
      {:ok, Base.encode64(json)}
    else
      {:error, :invalid_payload} = error ->
        error

      {:error, _reason} ->
        {:error, :invalid_json}
    end
  end

  def encode_header(_payload), do: {:error, :invalid_payload}

  @doc since: "0.3.0", group: :headers
  @doc """
  Decodes a SIWX `SIGN-IN-WITH-X` header.

  ## Examples

      iex> {:ok, encoded} = X402.Extensions.SIWX.encode_header(%{message: "hello", signature: "0xabc"})
      iex> X402.Extensions.SIWX.decode_header(encoded)
      {:ok, %{"message" => "hello", "signature" => "0xabc"}}

      iex> X402.Extensions.SIWX.decode_header("%%")
      {:error, :invalid_base64}
  """
  @spec decode_header(String.t()) :: {:ok, map()} | {:error, header_decode_error()}
  def decode_header(value) when is_binary(value) do
    with {:ok, json} <- decode_base64(value),
         {:ok, decoded} <- Jason.decode(json),
         true <- is_map(decoded),
         {:ok, message} <- fetch_non_empty_binary(decoded, :message),
         {:ok, signature} <- fetch_non_empty_binary(decoded, :signature) do
      {:ok, %{"message" => message, "signature" => signature}}
    else
      {:error, :invalid_base64} = error ->
        error

      {:error, %Jason.DecodeError{}} ->
        {:error, :invalid_json}

      false ->
        {:error, :invalid_json}

      {:error, :invalid_payload} = error ->
        error
    end
  end

  def decode_header(_value), do: {:error, :invalid_base64}

  @spec parse_message(String.t()) :: {:ok, map()} | {:error, decode_error()}
  defp parse_message(message) do
    case String.split(message, "\n", trim: false) do
      [
        domain_line,
        address,
        "",
        statement,
        "",
        uri_line,
        version_line,
        chain_id_line,
        nonce_line,
        issued_at_line,
        expiration_time_line
      ] ->
        with {:ok, domain} <- parse_domain(domain_line),
             {:ok, uri} <- parse_prefixed_value(uri_line, "URI: ", :uri),
             {:ok, version} <- parse_prefixed_value(version_line, "Version: ", :version),
             {:ok, chain_id} <- parse_chain_line(chain_id_line),
             {:ok, nonce} <- parse_prefixed_value(nonce_line, "Nonce: ", :nonce),
             {:ok, issued_at} <- parse_prefixed_value(issued_at_line, "Issued At: ", :issued_at),
             {:ok, expiration_time} <-
               parse_prefixed_value(expiration_time_line, "Expiration Time: ", :expiration_time) do
          {:ok,
           %{
             domain: domain,
             address: address,
             statement: statement,
             uri: uri,
             version: version,
             chain_id: chain_id,
             nonce: nonce,
             issued_at: issued_at,
             expiration_time: expiration_time
           }}
        end

      _other ->
        {:error, :invalid_message}
    end
  end

  @spec parse_domain(String.t()) :: {:ok, String.t()} | {:error, decode_error()}
  defp parse_domain(line) do
    case String.ends_with?(line, @domain_suffix) do
      true ->
        domain = String.replace_suffix(line, @domain_suffix, "")

        case domain do
          "" -> {:error, {:invalid_field, :domain}}
          _ -> {:ok, domain}
        end

      false ->
        {:error, :invalid_message}
    end
  end

  @spec parse_prefixed_value(String.t(), String.t(), atom()) ::
          {:ok, String.t()} | {:error, decode_error()}
  defp parse_prefixed_value(line, prefix, field) do
    case String.starts_with?(line, prefix) do
      true ->
        value = String.replace_prefix(line, prefix, "")

        case value do
          "" -> {:error, {:invalid_field, field}}
          _ -> {:ok, value}
        end

      false ->
        {:error, :invalid_message}
    end
  end

  @spec parse_chain_line(String.t()) :: {:ok, String.t()} | {:error, decode_error()}
  defp parse_chain_line(line) do
    with {:ok, chain_id_value} <- parse_prefixed_value(line, "Chain ID: ", :chain_id),
         {chain_ref, ""} <- Integer.parse(chain_id_value),
         true <- chain_ref > 0 do
      {:ok, "eip155:#{chain_ref}"}
    else
      _ -> {:error, {:invalid_field, :chain_id}}
    end
  end

  @spec normalize_payload(map()) :: {:ok, map()} | {:error, encode_error()}
  defp normalize_payload(payload) do
    missing =
      Enum.reject(@required_message_fields, fn field ->
        match?({:ok, _value}, fetch_required(payload, field))
      end)

    case missing do
      [] ->
        with {:ok, domain} <- fetch_non_empty_binary(payload, :domain),
             {:ok, address} <- validate_address(payload),
             {:ok, statement} <- validate_statement(payload),
             {:ok, uri} <- validate_uri(payload),
             {:ok, version} <- validate_version(payload),
             {:ok, {chain_id, chain_ref}} <- validate_chain_id(payload),
             {:ok, nonce} <- validate_nonce(payload),
             {:ok, issued_at_datetime} <- validate_datetime(payload, :issued_at),
             {:ok, expiration_datetime} <- validate_datetime(payload, :expiration_time),
             :ok <- validate_expiration(issued_at_datetime, expiration_datetime) do
          {:ok,
           %{
             domain: domain,
             address: address,
             statement: statement,
             uri: uri,
             version: version,
             chain_id: chain_id,
             chain_ref: chain_ref,
             nonce: nonce,
             issued_at: DateTime.to_iso8601(issued_at_datetime),
             expiration_time: DateTime.to_iso8601(expiration_datetime)
           }}
        end

      _missing ->
        {:error, {:missing_fields, missing}}
    end
  end

  @spec fetch_required(map(), atom()) :: {:ok, term()} | {:error, :invalid_payload}
  defp fetch_required(payload, field) do
    case Map.fetch(payload, field) do
      {:ok, value} -> {:ok, value}
      :error -> Map.fetch(payload, Atom.to_string(field))
    end
  end

  @spec fetch_non_empty_binary(map(), atom()) :: {:ok, String.t()} | {:error, :invalid_payload}
  defp fetch_non_empty_binary(payload, field) do
    with {:ok, value} <- fetch_required(payload, field),
         true <- is_binary(value),
         true <- value != "" do
      {:ok, value}
    else
      _ -> {:error, :invalid_payload}
    end
  end

  @spec validate_address(map()) :: {:ok, String.t()} | {:error, {:invalid_field, :address}}
  defp validate_address(payload) do
    case fetch_non_empty_binary(payload, :address) do
      {:ok, address} ->
        case Wallet.valid_evm?(address) do
          true -> {:ok, address}
          false -> {:error, {:invalid_field, :address}}
        end

      {:error, :invalid_payload} ->
        {:error, {:invalid_field, :address}}
    end
  end

  @spec validate_statement(map()) :: {:ok, String.t()} | {:error, {:invalid_field, :statement}}
  defp validate_statement(payload) do
    case fetch_non_empty_binary(payload, :statement) do
      {:ok, statement} ->
        case String.contains?(statement, "\n") do
          true -> {:error, {:invalid_field, :statement}}
          false -> {:ok, statement}
        end

      {:error, :invalid_payload} ->
        {:error, {:invalid_field, :statement}}
    end
  end

  @spec validate_uri(map()) :: {:ok, String.t()} | {:error, {:invalid_field, :uri}}
  defp validate_uri(payload) do
    case fetch_non_empty_binary(payload, :uri) do
      {:ok, uri} ->
        parsed = URI.parse(uri)

        case parsed.scheme do
          nil -> {:error, {:invalid_field, :uri}}
          _scheme -> {:ok, uri}
        end

      {:error, :invalid_payload} ->
        {:error, {:invalid_field, :uri}}
    end
  end

  @spec validate_version(map()) :: {:ok, String.t()} | {:error, {:invalid_field, :version}}
  defp validate_version(payload) do
    case fetch_non_empty_binary(payload, :version) do
      {:ok, @siwe_version = version} -> {:ok, version}
      _ -> {:error, {:invalid_field, :version}}
    end
  end

  @spec validate_chain_id(map()) ::
          {:ok, {String.t(), pos_integer()}} | {:error, {:invalid_field, :chain_id}}
  defp validate_chain_id(payload) do
    case fetch_required(payload, :chain_id) do
      {:ok, "eip155:" <> chain_reference} ->
        parse_chain_reference(chain_reference)

      {:ok, chain_reference} when is_integer(chain_reference) and chain_reference > 0 ->
        {:ok, {"eip155:#{chain_reference}", chain_reference}}

      {:ok, chain_reference} when is_binary(chain_reference) ->
        with {parsed, ""} <- Integer.parse(chain_reference),
             true <- parsed > 0 do
          {:ok, {"eip155:#{parsed}", parsed}}
        else
          _ -> {:error, {:invalid_field, :chain_id}}
        end

      _ ->
        {:error, {:invalid_field, :chain_id}}
    end
  end

  @spec parse_chain_reference(String.t()) ::
          {:ok, {String.t(), pos_integer()}} | {:error, {:invalid_field, :chain_id}}
  defp parse_chain_reference(chain_reference) do
    with {parsed, ""} <- Integer.parse(chain_reference),
         true <- parsed > 0 do
      {:ok, {"eip155:#{parsed}", parsed}}
    else
      _ -> {:error, {:invalid_field, :chain_id}}
    end
  end

  @spec validate_nonce(map()) :: {:ok, String.t()} | {:error, {:invalid_field, :nonce}}
  defp validate_nonce(payload) do
    case fetch_non_empty_binary(payload, :nonce) do
      {:ok, nonce} ->
        case nonce =~ @nonce_regex do
          true -> {:ok, nonce}
          false -> {:error, {:invalid_field, :nonce}}
        end

      {:error, :invalid_payload} ->
        {:error, {:invalid_field, :nonce}}
    end
  end

  @spec validate_datetime(map(), atom()) ::
          {:ok, DateTime.t()} | {:error, {:invalid_field, atom()}}
  defp validate_datetime(payload, field) do
    case fetch_non_empty_binary(payload, field) do
      {:ok, value} ->
        case DateTime.from_iso8601(value) do
          {:ok, datetime, _offset} -> {:ok, datetime}
          {:error, _reason} -> {:error, {:invalid_field, field}}
        end

      {:error, :invalid_payload} ->
        {:error, {:invalid_field, field}}
    end
  end

  @spec validate_expiration(DateTime.t(), DateTime.t()) ::
          :ok | {:error, {:invalid_field, :expiration_time}}
  defp validate_expiration(issued_at_datetime, expiration_datetime) do
    case DateTime.compare(expiration_datetime, issued_at_datetime) do
      :gt -> :ok
      _other -> {:error, {:invalid_field, :expiration_time}}
    end
  end

  @spec decode_base64(String.t()) :: {:ok, String.t()} | {:error, :invalid_base64}
  defp decode_base64(""), do: {:error, :invalid_base64}

  defp decode_base64(value) do
    case Base.decode64(value) do
      {:ok, decoded} -> {:ok, decoded}
      :error -> {:error, :invalid_base64}
    end
  end
end
