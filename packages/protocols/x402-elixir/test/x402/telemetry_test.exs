defmodule X402.TelemetryTest do
  use ExUnit.Case, async: true

  doctest X402.Telemetry

  alias X402.PaymentRequired
  alias X402.Telemetry

  describe "event_name/2" do
    test "builds event names with x402 prefix" do
      assert Telemetry.event_name(:payment_required, :encode) ==
               [:x402, :payment_required, :encode]
    end
  end

  describe "emit/4" do
    test "executes telemetry events with status metadata" do
      handler_id = "x402-test-#{System.unique_integer([:positive])}"

      :ok =
        :telemetry.attach(
          handler_id,
          [:x402, :payment_required, :encode],
          fn event, measurements, metadata, _config ->
            send(self(), {:telemetry_event, event, measurements, metadata})
          end,
          nil
        )

      on_exit(fn -> :telemetry.detach(handler_id) end)

      assert :ok = Telemetry.emit(:payment_required, :encode, :ok, %{header: "PAYMENT-REQUIRED"})

      assert_receive {:telemetry_event, [:x402, :payment_required, :encode], %{count: 1},
                      %{header: "PAYMENT-REQUIRED", status: :ok}}
    end
  end

  describe "module integrations" do
    test "payment-required emits decode telemetry events" do
      handler_id = "x402-test-#{System.unique_integer([:positive])}"

      :ok =
        :telemetry.attach(
          handler_id,
          [:x402, :payment_required, :decode],
          fn event, measurements, metadata, _config ->
            send(self(), {:decode_event, event, measurements, metadata})
          end,
          nil
        )

      on_exit(fn -> :telemetry.detach(handler_id) end)

      assert {:ok, encoded} = PaymentRequired.encode(%{"scheme" => "exact"})
      assert {:ok, _payload} = PaymentRequired.decode(encoded)

      assert_receive {:decode_event, [:x402, :payment_required, :decode], %{count: 1},
                      %{header: "PAYMENT-REQUIRED", status: :ok}}
    end
  end
end
