defmodule X402.PaymentResponse do
  @moduledoc """
  Encodes and decodes the x402 `PAYMENT-RESPONSE` header value.

  The header is Base64-encoded JSON and is typically returned by a server after
  settlement.
  """

  alias X402.Telemetry

  # Single source of truth for the 8 KB decode guard — see X402.Header.
  @max_header_bytes X402.Header.max_header_bytes()

  @type encode_error :: :invalid_payload | :invalid_json
  @type decode_error :: :invalid_base64 | :invalid_json | :payload_too_large

  @doc since: "0.1.0", group: :headers
  @doc """
  Returns the canonical x402 header name.

  ## Examples

      iex> X402.PaymentResponse.header_name()
      "PAYMENT-RESPONSE"
  """
  @spec header_name() :: String.t()
  def header_name, do: "PAYMENT-RESPONSE"

  @doc since: "0.1.0", group: :headers
  @doc """
  Encodes a settlement response payload to a Base64 header value.

  ## Examples

      iex> {:ok, value} = X402.PaymentResponse.encode(%{"settled" => true})
      iex> X402.PaymentResponse.decode(value)
      {:ok, %{"settled" => true}}
  """
  @spec encode(map()) :: {:ok, String.t()} | {:error, encode_error()}
  def encode(payload) when is_map(payload) do
    case Jason.encode(payload) do
      {:ok, json} ->
        result = {:ok, Base.encode64(json)}
        Telemetry.emit(:payment_response, :encode, :ok, %{header: header_name()})
        result

      {:error, _reason} ->
        Telemetry.emit(:payment_response, :encode, :error, %{
          reason: :invalid_json,
          header: header_name()
        })

        {:error, :invalid_json}
    end
  end

  def encode(_payload) do
    Telemetry.emit(:payment_response, :encode, :error, %{
      reason: :invalid_payload,
      header: header_name()
    })

    {:error, :invalid_payload}
  end

  @doc since: "0.1.0", group: :headers
  @doc """
  Decodes a Base64 `PAYMENT-RESPONSE` value to a map.

  Returns `{:error, :payload_too_large}` when the encoded value exceeds 8 KB.
  Returns `{:error, :invalid_base64}` when the value cannot be Base64-decoded.
  Returns `{:error, :invalid_json}` when JSON cannot be decoded to a map.

  ## Examples

      iex> {:ok, value} = X402.PaymentResponse.encode(%{"settled" => true})
      iex> X402.PaymentResponse.decode(value)
      {:ok, %{"settled" => true}}

      iex> X402.PaymentResponse.decode("%%%")
      {:error, :invalid_base64}
  """
  @spec decode(String.t()) :: {:ok, map()} | {:error, decode_error()}
  def decode(value) when is_binary(value) do
    if byte_size(value) > @max_header_bytes do
      Telemetry.emit(:payment_response, :decode, :error, %{
        reason: :payload_too_large,
        header: header_name()
      })

      {:error, :payload_too_large}
    else
      with {:ok, json} <- decode_base64(value),
           {:ok, decoded} <- Jason.decode(json),
           true <- is_map(decoded) do
        result = {:ok, decoded}
        Telemetry.emit(:payment_response, :decode, :ok, %{header: header_name()})
        result
      else
        {:error, :invalid_base64} = error ->
          Telemetry.emit(:payment_response, :decode, :error, %{
            reason: :invalid_base64,
            header: header_name()
          })

          error

        {:error, %Jason.DecodeError{}} ->
          Telemetry.emit(:payment_response, :decode, :error, %{
            reason: :invalid_json,
            header: header_name()
          })

          {:error, :invalid_json}

        false ->
          Telemetry.emit(:payment_response, :decode, :error, %{
            reason: :invalid_json,
            header: header_name()
          })

          {:error, :invalid_json}
      end
    end
  end

  def decode(_value) do
    Telemetry.emit(:payment_response, :decode, :error, %{
      reason: :invalid_base64,
      header: header_name()
    })

    {:error, :invalid_base64}
  end

  @spec decode_base64(String.t()) :: {:ok, String.t()} | {:error, :invalid_base64}
  defp decode_base64(""), do: {:error, :invalid_base64}

  defp decode_base64(value) do
    case Base.decode64(value, padding: false) do
      {:ok, decoded} -> {:ok, decoded}
      :error -> {:error, :invalid_base64}
    end
  end
end
