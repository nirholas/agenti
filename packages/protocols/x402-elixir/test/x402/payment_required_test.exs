defmodule X402.PaymentRequiredTest do
  use ExUnit.Case, async: true

  doctest X402.PaymentRequired

  alias X402.PaymentRequired

  describe "header_name/0" do
    test "returns PAYMENT-REQUIRED" do
      assert PaymentRequired.header_name() == "PAYMENT-REQUIRED"
    end
  end

  describe "encode/1" do
    test "encodes a map payload" do
      payload = %{"scheme" => "exact", "maxAmountRequired" => "100"}

      assert {:ok, encoded} = PaymentRequired.encode(payload)
      assert {:ok, ^payload} = PaymentRequired.decode(encoded)
    end

    test "returns invalid_payload for non-map payloads" do
      assert PaymentRequired.encode(nil) == {:error, :invalid_payload}
      assert PaymentRequired.encode("") == {:error, :invalid_payload}
    end

    test "returns invalid_json for non-encodable map values" do
      assert PaymentRequired.encode(%{"bad" => self()}) == {:error, :invalid_json}
    end

    test "encodes an upto payload with maxPrice" do
      payload = %{"scheme" => "upto", "maxPrice" => "100"}

      assert {:ok, encoded} = PaymentRequired.encode(payload)
      assert {:ok, ^payload} = PaymentRequired.decode(encoded)
    end

    test "normalizes legacy upto payload key to maxPrice while encoding" do
      legacy_payload = %{"scheme" => "upto", "maxAmountRequired" => "100"}

      assert {:ok, encoded} = PaymentRequired.encode(legacy_payload)
      assert {:ok, decoded} = PaymentRequired.decode(encoded)

      assert decoded["scheme"] == "upto"
      assert decoded["maxPrice"] == "100"
      refute Map.has_key?(decoded, "maxAmountRequired")
    end
  end

  describe "decode/1" do
    test "returns invalid_base64 for nil and malformed base64" do
      assert PaymentRequired.decode(nil) == {:error, :invalid_base64}
      assert PaymentRequired.decode("%%%") == {:error, :invalid_base64}
      assert PaymentRequired.decode("") == {:error, :invalid_base64}
    end

    test "returns invalid_json for invalid json" do
      invalid_json = Base.encode64("{")
      assert PaymentRequired.decode(invalid_json) == {:error, :invalid_json}
    end

    test "returns invalid_json for json that is not a map" do
      not_map = Base.encode64("[]")
      assert PaymentRequired.decode(not_map) == {:error, :invalid_json}
    end

    test "normalizes upto accepts entries to maxPrice" do
      payload =
        %{
          "accepts" => [
            %{"scheme" => "upto", "maxAmountRequired" => "42"},
            %{"scheme" => "exact", "maxAmountRequired" => "7"}
          ]
        }
        |> Jason.encode!()
        |> Base.encode64()

      assert {:ok, decoded} = PaymentRequired.decode(payload)
      [upto, exact] = decoded["accepts"]

      assert upto["scheme"] == "upto"
      assert upto["maxPrice"] == "42"
      refute Map.has_key?(upto, "maxAmountRequired")

      assert exact["scheme"] == "exact"
      assert exact["maxAmountRequired"] == "7"
    end

    test "returns payload_too_large for oversized header values" do
      # 8 KB + 1 byte of valid-ish Base64 — must be rejected before decode
      oversized = String.duplicate("A", 8_193)
      assert PaymentRequired.decode(oversized) == {:error, :payload_too_large}
    end

    test "accepts header values at exactly the 8 KB limit" do
      # Exactly 8,192 bytes — the > guard must allow this through (not >=)
      at_limit = String.duplicate("A", 8_192)
      # Valid Base64 (6 144 null bytes) but not valid JSON — deterministically :invalid_json
      assert PaymentRequired.decode(at_limit) == {:error, :invalid_json}
    end
  end
end
