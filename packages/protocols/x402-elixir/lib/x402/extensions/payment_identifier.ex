defmodule X402.Extensions.PaymentIdentifier do
  @moduledoc """
  Encodes and decodes x402 payment identifier payloads.

  The payment identifier extension payload is Base64-encoded JSON with a
  required `"paymentId"` field.
  """

  @typedoc "Payment identifier value used for idempotency."
  @type payment_id :: String.t()

  @type encode_error :: :invalid_payment_id | :invalid_json

  @type decode_error ::
          :invalid_base64 | :invalid_json | :missing_payment_id | :invalid_payment_id

  @doc since: "0.1.0"
  @doc """
  Encodes a payment identifier to a Base64 JSON payload.

  ## Examples

      iex> {:ok, encoded} = X402.Extensions.PaymentIdentifier.encode("payment-123")
      iex> {:ok, "payment-123"} = X402.Extensions.PaymentIdentifier.decode(encoded)
  """
  @spec encode(payment_id()) :: {:ok, String.t()} | {:error, encode_error()}
  def encode(payment_id) when is_binary(payment_id) and payment_id != "" do
    payload = %{"paymentId" => payment_id}

    case Jason.encode(payload) do
      {:ok, json} -> {:ok, Base.encode64(json)}
      {:error, _reason} -> {:error, :invalid_json}
    end
  end

  def encode(_payment_id), do: {:error, :invalid_payment_id}

  @doc since: "0.1.0"
  @doc """
  Decodes a Base64 JSON payload and returns the payment identifier.

  ## Examples

      iex> {:ok, encoded} = X402.Extensions.PaymentIdentifier.encode("payment-123")
      iex> X402.Extensions.PaymentIdentifier.decode(encoded)
      {:ok, "payment-123"}

      iex> X402.Extensions.PaymentIdentifier.decode("not-base64")
      {:error, :invalid_base64}
  """
  @spec decode(String.t()) :: {:ok, payment_id()} | {:error, decode_error()}
  def decode(value) when is_binary(value) do
    with {:ok, json} <- decode_base64(value),
         {:ok, decoded} <- Jason.decode(json),
         {:ok, payment_id} <- fetch_payment_id(decoded) do
      {:ok, payment_id}
    else
      {:error, :invalid_base64} -> {:error, :invalid_base64}
      {:error, :missing_payment_id} -> {:error, :missing_payment_id}
      {:error, :invalid_payment_id} -> {:error, :invalid_payment_id}
      {:error, %Jason.DecodeError{}} -> {:error, :invalid_json}
    end
  end

  def decode(_value), do: {:error, :invalid_base64}

  @doc since: "0.1.0"
  @doc """
  Extracts and validates `"paymentId"` from a decoded payload map.

  ## Examples

      iex> X402.Extensions.PaymentIdentifier.fetch_payment_id(%{"paymentId" => "pay-1"})
      {:ok, "pay-1"}

      iex> X402.Extensions.PaymentIdentifier.fetch_payment_id(%{})
      {:error, :missing_payment_id}
  """
  @spec fetch_payment_id(term()) ::
          {:ok, payment_id()} | {:error, :missing_payment_id | :invalid_payment_id}
  def fetch_payment_id(payload) when is_map(payload) do
    case Map.fetch(payload, "paymentId") do
      {:ok, payment_id} when is_binary(payment_id) and payment_id != "" -> {:ok, payment_id}
      {:ok, _invalid} -> {:error, :invalid_payment_id}
      :error -> {:error, :missing_payment_id}
    end
  end

  def fetch_payment_id(_payload), do: {:error, :invalid_payment_id}

  @spec decode_base64(String.t()) :: {:ok, String.t()} | {:error, :invalid_base64}
  defp decode_base64(""), do: {:error, :invalid_base64}

  defp decode_base64(value) do
    case Base.decode64(value) do
      {:ok, decoded} -> {:ok, decoded}
      :error -> {:error, :invalid_base64}
    end
  end
end
