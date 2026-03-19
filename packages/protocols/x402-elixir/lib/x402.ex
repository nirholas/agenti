defmodule X402 do
  @moduledoc """
  Convenience API for working with x402 payment headers and wallet addresses.

  `X402` exposes the most common encode/decode and validation operations while
  delegating implementation details to dedicated modules:

  - `X402.PaymentRequired` for `PAYMENT-REQUIRED`
  - `X402.PaymentSignature` for `PAYMENT-SIGNATURE`
  - `X402.PaymentResponse` for `PAYMENT-RESPONSE`
  - `X402.Wallet` for wallet address detection and validation
  """

  alias X402.PaymentRequired
  alias X402.PaymentResponse
  alias X402.PaymentSignature
  alias X402.Wallet

  @doc since: "0.1.0", group: :headers
  @doc """
  Encodes a `PAYMENT-REQUIRED` header payload.

  ## Examples

      iex> {:ok, header} = X402.encode_payment_required(%{"scheme" => "exact"})
      iex> is_binary(header)
      true
  """
  @spec encode_payment_required(map()) ::
          {:ok, String.t()} | {:error, :invalid_payload | :invalid_json}
  defdelegate encode_payment_required(payload), to: PaymentRequired, as: :encode

  @doc since: "0.1.0", group: :headers
  @doc """
  Decodes a `PAYMENT-REQUIRED` header payload.

  ## Examples

      iex> {:ok, encoded} = X402.PaymentRequired.encode(%{"scheme" => "exact"})
      iex> {:ok, decoded} = X402.decode_payment_required(encoded)
      iex> decoded["scheme"]
      "exact"
  """
  @spec decode_payment_required(String.t()) ::
          {:ok, map()} | {:error, :invalid_base64 | :invalid_json | :payload_too_large}
  defdelegate decode_payment_required(header), to: PaymentRequired, as: :decode

  @doc since: "0.1.0", group: :headers
  @doc """
  Decodes a `PAYMENT-SIGNATURE` header payload.

  ## Examples

      iex> payload = %{
      ...>   "transactionHash" => "0xabc",
      ...>   "network" => "eip155:8453",
      ...>   "scheme" => "exact",
      ...>   "payerWallet" => "0x1111111111111111111111111111111111111111"
      ...> }
      iex> encoded = payload |> Jason.encode!() |> Base.encode64()
      iex> {:ok, decoded} = X402.decode_payment_signature(encoded)
      iex> decoded["network"]
      "eip155:8453"
  """
  @spec decode_payment_signature(String.t()) ::
          {:ok, map()} | {:error, :invalid_base64 | :invalid_json}
  defdelegate decode_payment_signature(header), to: PaymentSignature, as: :decode

  @doc since: "0.1.0", group: :verification
  @doc """
  Validates a decoded `PAYMENT-SIGNATURE` payload.

  ## Examples

      iex> X402.validate_payment_signature(%{
      ...>   "transactionHash" => "0xabc",
      ...>   "network" => "eip155:8453",
      ...>   "scheme" => "exact",
      ...>   "payerWallet" => "0x1111111111111111111111111111111111111111"
      ...> })
      {:ok, %{
        "network" => "eip155:8453",
        "payerWallet" => "0x1111111111111111111111111111111111111111",
        "scheme" => "exact",
        "transactionHash" => "0xabc"
      }}
  """
  @spec validate_payment_signature(map()) ::
          {:ok, map()}
          | {:error,
             :invalid_payload
             | {:missing_fields, [String.t()]}
             | {:invalid_upto_payment, X402.PaymentSignature.upto_validation_error()}}
  defdelegate validate_payment_signature(payload), to: PaymentSignature, as: :validate

  @doc since: "0.1.0", group: :verification
  @doc """
  Decodes and validates a `PAYMENT-SIGNATURE` payload.

  ## Examples

      iex> payload = %{
      ...>   "transactionHash" => "0xabc",
      ...>   "network" => "eip155:8453",
      ...>   "scheme" => "exact",
      ...>   "payerWallet" => "0x1111111111111111111111111111111111111111"
      ...> }
      iex> encoded = payload |> Jason.encode!() |> Base.encode64()
      iex> {:ok, _decoded} = X402.decode_and_validate_payment_signature(encoded)
  """
  @spec decode_and_validate_payment_signature(String.t()) ::
          {:ok, map()}
          | {:error,
             :invalid_base64
             | :invalid_json
             | :invalid_payload
             | {:missing_fields, [String.t()]}
             | {:invalid_upto_payment, X402.PaymentSignature.upto_validation_error()}}
  defdelegate decode_and_validate_payment_signature(header),
    to: PaymentSignature,
    as: :decode_and_validate

  @doc since: "0.1.0", group: :headers
  @doc """
  Encodes a `PAYMENT-RESPONSE` header payload.

  ## Examples

      iex> {:ok, header} = X402.encode_payment_response(%{"settled" => true})
      iex> is_binary(header)
      true
  """
  @spec encode_payment_response(map()) ::
          {:ok, String.t()} | {:error, :invalid_payload | :invalid_json}
  defdelegate encode_payment_response(payload), to: PaymentResponse, as: :encode

  @doc since: "0.1.0", group: :headers
  @doc """
  Decodes a `PAYMENT-RESPONSE` header payload.

  ## Examples

      iex> {:ok, encoded} = X402.PaymentResponse.encode(%{"settled" => true})
      iex> {:ok, decoded} = X402.decode_payment_response(encoded)
      iex> decoded["settled"]
      true
  """
  @spec decode_payment_response(String.t()) ::
          {:ok, map()} | {:error, :invalid_base64 | :invalid_json | :payload_too_large}
  defdelegate decode_payment_response(header), to: PaymentResponse, as: :decode

  @doc since: "0.1.0"
  @doc """
  Returns `true` when the wallet address is a valid EVM or Solana address.

  ## Examples

      iex> X402.valid_wallet?("0x1111111111111111111111111111111111111111")
      true

      iex> X402.valid_wallet?("not-a-wallet")
      false
  """
  @spec valid_wallet?(term()) :: boolean()
  defdelegate valid_wallet?(wallet), to: Wallet, as: :valid?

  @doc since: "0.1.0"
  @doc """
  Returns the wallet type.

  ## Examples

      iex> X402.wallet_type("0x1111111111111111111111111111111111111111")
      :evm

      iex> X402.wallet_type("9xQeWvG816bUx9EPfQmQTYnC16hHhV6bQf8kX6y4YB9")
      :solana
  """
  @spec wallet_type(term()) :: :evm | :solana | :unknown
  defdelegate wallet_type(wallet), to: Wallet, as: :type
end
