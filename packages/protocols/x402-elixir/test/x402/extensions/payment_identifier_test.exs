defmodule X402.Extensions.PaymentIdentifierTest do
  use ExUnit.Case, async: true

  doctest X402.Extensions.PaymentIdentifier

  alias X402.Extensions.PaymentIdentifier

  test "encode/1 returns Base64 JSON payload with paymentId" do
    assert {:ok, encoded} = PaymentIdentifier.encode("payment-123")

    assert {:ok, decoded_json} = Base.decode64(encoded)
    assert %{"paymentId" => "payment-123"} = Jason.decode!(decoded_json)
  end

  test "encode/1 rejects empty and non-binary payment identifiers" do
    assert {:error, :invalid_payment_id} = PaymentIdentifier.encode("")
    assert {:error, :invalid_payment_id} = PaymentIdentifier.encode(nil)
    assert {:error, :invalid_payment_id} = PaymentIdentifier.encode(123)
  end

  test "decode/1 returns payment identifier from encoded payload" do
    assert {:ok, encoded} = PaymentIdentifier.encode("payment-abc")
    assert {:ok, "payment-abc"} = PaymentIdentifier.decode(encoded)
  end

  test "decode/1 handles malformed payloads" do
    assert {:error, :invalid_base64} = PaymentIdentifier.decode("not-base64")
    assert {:error, :invalid_base64} = PaymentIdentifier.decode("")
    assert {:error, :invalid_base64} = PaymentIdentifier.decode(nil)

    invalid_json = Base.encode64("not-json")
    assert {:error, :invalid_json} = PaymentIdentifier.decode(invalid_json)

    missing_id = Base.encode64(Jason.encode!(%{"foo" => "bar"}))
    assert {:error, :missing_payment_id} = PaymentIdentifier.decode(missing_id)

    invalid_id = Base.encode64(Jason.encode!(%{"paymentId" => 123}))
    assert {:error, :invalid_payment_id} = PaymentIdentifier.decode(invalid_id)
  end

  test "fetch_payment_id/1 validates paymentId field" do
    assert {:ok, "payment-1"} = PaymentIdentifier.fetch_payment_id(%{"paymentId" => "payment-1"})
    assert {:error, :missing_payment_id} = PaymentIdentifier.fetch_payment_id(%{})

    assert {:error, :invalid_payment_id} =
             PaymentIdentifier.fetch_payment_id(%{"paymentId" => ""})

    assert {:error, :invalid_payment_id} = PaymentIdentifier.fetch_payment_id(%{"paymentId" => 1})
    assert {:error, :invalid_payment_id} = PaymentIdentifier.fetch_payment_id("bad")
  end
end
