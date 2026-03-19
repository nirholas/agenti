defmodule X402.PaymentRequired do
  @moduledoc """
  Encodes and decodes the x402 `PAYMENT-REQUIRED` header value.

  The header value is Base64-encoded JSON. This module provides safe conversion
  functions that return tagged tuples instead of raising.
  """

  alias X402.Telemetry

  # Single source of truth for the 8 KB decode guard — see X402.Header.
  @max_header_bytes X402.Header.max_header_bytes()

  @type scheme :: String.t()
  @type encode_error :: :invalid_payload | :invalid_json
  @type decode_error :: :invalid_base64 | :invalid_json | :payload_too_large

  @doc since: "0.1.0", group: :headers
  @doc """
  Returns the canonical x402 header name.

  ## Examples

      iex> X402.PaymentRequired.header_name()
      "PAYMENT-REQUIRED"
  """
  @spec header_name() :: String.t()
  def header_name, do: "PAYMENT-REQUIRED"

  @doc since: "0.1.0", group: :headers
  @doc """
  Encodes a payment requirement payload to a Base64 header value.

  ## Examples

      iex> {:ok, value} = X402.PaymentRequired.encode(%{"scheme" => "exact", "maxAmountRequired" => "10"})
      iex> {:ok, decoded} = X402.PaymentRequired.decode(value)
      iex> decoded["maxAmountRequired"]
      "10"

      iex> X402.PaymentRequired.encode(nil)
      {:error, :invalid_payload}
  """
  @spec encode(map()) :: {:ok, String.t()} | {:error, encode_error()}
  def encode(payload) when is_map(payload) do
    normalized_payload = normalize_payload(payload)

    case Jason.encode(normalized_payload) do
      {:ok, json} ->
        result = {:ok, Base.encode64(json)}
        Telemetry.emit(:payment_required, :encode, :ok, %{header: header_name()})
        result

      {:error, _reason} ->
        Telemetry.emit(:payment_required, :encode, :error, %{
          reason: :invalid_json,
          header: header_name()
        })

        {:error, :invalid_json}
    end
  end

  def encode(_payload) do
    Telemetry.emit(:payment_required, :encode, :error, %{
      reason: :invalid_payload,
      header: header_name()
    })

    {:error, :invalid_payload}
  end

  @doc since: "0.1.0", group: :headers
  @doc """
  Decodes a Base64 `PAYMENT-REQUIRED` value to a map.

  Returns `{:error, :payload_too_large}` when the encoded value exceeds 8 KB.
  Returns `{:error, :invalid_base64}` when the value cannot be Base64-decoded.
  Returns `{:error, :invalid_json}` when JSON cannot be decoded to a map.

  ## Examples

      iex> {:ok, encoded} = X402.PaymentRequired.encode(%{"scheme" => "exact"})
      iex> X402.PaymentRequired.decode(encoded)
      {:ok, %{"scheme" => "exact"}}

      iex> X402.PaymentRequired.decode("%%%")
      {:error, :invalid_base64}
  """
  @spec decode(String.t()) :: {:ok, map()} | {:error, decode_error()}
  def decode(value) when is_binary(value) do
    if byte_size(value) > @max_header_bytes do
      Telemetry.emit(:payment_required, :decode, :error, %{
        reason: :payload_too_large,
        header: header_name()
      })

      {:error, :payload_too_large}
    else
      with {:ok, json} <- decode_base64(value),
           {:ok, decoded} <- Jason.decode(json),
           true <- is_map(decoded) do
        result = {:ok, normalize_payload(decoded)}
        Telemetry.emit(:payment_required, :decode, :ok, %{header: header_name()})
        result
      else
        {:error, :invalid_base64} = error ->
          Telemetry.emit(:payment_required, :decode, :error, %{
            reason: :invalid_base64,
            header: header_name()
          })

          error

        {:error, %Jason.DecodeError{}} ->
          Telemetry.emit(:payment_required, :decode, :error, %{
            reason: :invalid_json,
            header: header_name()
          })

          {:error, :invalid_json}

        false ->
          Telemetry.emit(:payment_required, :decode, :error, %{
            reason: :invalid_json,
            header: header_name()
          })

          {:error, :invalid_json}
      end
    end
  end

  def decode(_value) do
    Telemetry.emit(:payment_required, :decode, :error, %{
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

  @spec normalize_payload(map()) :: map()
  defp normalize_payload(payload) do
    payload
    |> normalize_upto_entry()
    |> normalize_accepts_entries()
  end

  @spec normalize_upto_entry(map()) :: map()
  defp normalize_upto_entry(payload) do
    case scheme(payload) do
      "upto" -> replace_amount_key(payload)
      :upto -> replace_amount_key(payload)
      _scheme -> payload
    end
  end

  @spec normalize_accepts_entries(map()) :: map()
  defp normalize_accepts_entries(payload) do
    case map_value(payload, {"accepts", :accepts}) do
      accepts when is_list(accepts) ->
        normalized =
          Enum.map(accepts, fn
            %{} = entry -> normalize_upto_entry(entry)
            other -> other
          end)

        map_put(payload, {"accepts", :accepts}, normalized)

      _other ->
        payload
    end
  end

  @spec replace_amount_key(map()) :: map()
  defp replace_amount_key(payload) do
    case map_value(payload, {"maxPrice", :maxPrice}) do
      nil ->
        case map_value(payload, {"maxAmountRequired", :maxAmountRequired}) do
          nil ->
            payload

          legacy_max_amount ->
            payload
            |> map_put({"maxPrice", :maxPrice}, legacy_max_amount)
            |> map_delete({"maxAmountRequired", :maxAmountRequired})
        end

      _max_price ->
        payload
    end
  end

  @spec scheme(map()) :: scheme() | atom() | nil
  defp scheme(payload), do: map_value(payload, {"scheme", :scheme})

  @spec map_value(map(), {String.t(), atom()}) :: term()
  defp map_value(map, {string_key, atom_key}) do
    case Map.fetch(map, string_key) do
      {:ok, value} ->
        value

      :error ->
        Map.get(map, atom_key)
    end
  end

  @spec map_put(map(), {String.t(), atom()}, term()) :: map()
  defp map_put(map, {string_key, atom_key}, value) do
    cond do
      Map.has_key?(map, string_key) ->
        Map.put(map, string_key, value)

      Map.has_key?(map, atom_key) ->
        Map.put(map, atom_key, value)

      true ->
        Map.put(map, string_key, value)
    end
  end

  @spec map_delete(map(), {String.t(), atom()}) :: map()
  defp map_delete(map, {string_key, atom_key}) do
    map
    |> Map.delete(string_key)
    |> Map.delete(atom_key)
  end
end
