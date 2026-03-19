defmodule X402.Extensions.SIWXTest do
  use ExUnit.Case, async: true

  doctest X402.Extensions.SIWX

  alias X402.Extensions.SIWX

  describe "header_name/0" do
    test "returns SIGN-IN-WITH-X" do
      assert SIWX.header_name() == "SIGN-IN-WITH-X"
    end
  end

  describe "encode/1 and decode/1" do
    test "roundtrips a valid SIWX payload" do
      payload = valid_payload()

      assert {:ok, message} = SIWX.encode(payload)
      assert {:ok, ^payload} = SIWX.decode(message)
    end

    test "supports integer chain_id on encode" do
      payload = Map.put(valid_payload(), :chain_id, 8453)

      assert {:ok, message} = SIWX.encode(payload)
      assert {:ok, decoded} = SIWX.decode(message)
      assert decoded.chain_id == "eip155:8453"
    end

    test "returns invalid_payload for non-map payloads" do
      assert SIWX.encode(nil) == {:error, :invalid_payload}
    end

    test "returns missing_fields when required fields are absent" do
      assert SIWX.encode(%{domain: "example.com"}) ==
               {:error,
                {:missing_fields,
                 [
                   :address,
                   :statement,
                   :uri,
                   :version,
                   :chain_id,
                   :nonce,
                   :issued_at,
                   :expiration_time
                 ]}}
    end

    test "rejects invalid payload fields" do
      invalid_address = Map.put(valid_payload(), :address, "0x123")
      assert SIWX.encode(invalid_address) == {:error, {:invalid_field, :address}}

      invalid_chain_id = Map.put(valid_payload(), :chain_id, "solana:mainnet")
      assert SIWX.encode(invalid_chain_id) == {:error, {:invalid_field, :chain_id}}

      invalid_nonce = Map.put(valid_payload(), :nonce, "short")
      assert SIWX.encode(invalid_nonce) == {:error, {:invalid_field, :nonce}}

      invalid_version = Map.put(valid_payload(), :version, "2")
      assert SIWX.encode(invalid_version) == {:error, {:invalid_field, :version}}

      invalid_expiration =
        valid_payload()
        |> Map.put(:issued_at, "2026-02-16T13:00:00Z")
        |> Map.put(:expiration_time, "2026-02-16T12:00:00Z")

      assert SIWX.encode(invalid_expiration) == {:error, {:invalid_field, :expiration_time}}
    end

    test "returns invalid_message when format is malformed" do
      assert SIWX.decode("not a siwx message") == {:error, :invalid_message}
      assert SIWX.decode(nil) == {:error, :invalid_message}
    end

    test "returns invalid field errors for malformed message fields" do
      payload = valid_payload()
      {:ok, message} = SIWX.encode(payload)

      invalid_chain_message = String.replace(message, "Chain ID: 1", "Chain ID: abc")
      assert SIWX.decode(invalid_chain_message) == {:error, {:invalid_field, :chain_id}}

      invalid_address_message =
        String.replace(message, payload.address, "0x111111111111111111111111111111111111111")

      assert SIWX.decode(invalid_address_message) == {:error, {:invalid_field, :address}}
    end
  end

  describe "encode_header/1 and decode_header/1" do
    test "roundtrips a valid header payload" do
      payload = %{message: "sign-in message", signature: "0xabcdef"}

      assert {:ok, encoded_header} = SIWX.encode_header(payload)

      assert SIWX.decode_header(encoded_header) ==
               {:ok, %{"message" => "sign-in message", "signature" => "0xabcdef"}}
    end

    test "returns invalid payload for malformed encode payloads" do
      assert SIWX.encode_header(nil) == {:error, :invalid_payload}
      assert SIWX.encode_header(%{message: "only message"}) == {:error, :invalid_payload}
      assert SIWX.encode_header(%{message: "", signature: "0xabc"}) == {:error, :invalid_payload}
    end

    test "returns decode errors for malformed headers" do
      assert SIWX.decode_header("%%") == {:error, :invalid_base64}
      assert SIWX.decode_header("") == {:error, :invalid_base64}
      assert SIWX.decode_header(nil) == {:error, :invalid_base64}

      invalid_json = Base.encode64("{")
      assert SIWX.decode_header(invalid_json) == {:error, :invalid_json}

      not_map = Base.encode64("[]")
      assert SIWX.decode_header(not_map) == {:error, :invalid_json}

      missing_signature = Base.encode64(Jason.encode!(%{"message" => "ok"}))
      assert SIWX.decode_header(missing_signature) == {:error, :invalid_payload}
    end
  end

  defp valid_payload do
    %{
      domain: "example.com",
      address: "0x1111111111111111111111111111111111111111",
      statement: "Access purchased content",
      uri: "https://example.com/protected",
      version: "1",
      chain_id: "eip155:1",
      nonce: "abc12345",
      issued_at: "2026-02-16T12:00:00Z",
      expiration_time: "2026-02-16T13:00:00Z"
    }
  end
end
