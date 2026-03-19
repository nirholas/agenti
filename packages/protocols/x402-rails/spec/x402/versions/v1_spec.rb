# frozen_string_literal: true

RSpec.describe X402::Versions::V1 do
  let(:strategy) { described_class.new }

  describe "#version_number" do
    it "returns 1" do
      expect(strategy.version_number).to eq(1)
    end
  end

  describe "#payment_header_name" do
    it "returns X-PAYMENT" do
      expect(strategy.payment_header_name).to eq("X-PAYMENT")
    end
  end

  describe "#response_header_name" do
    it "returns X-PAYMENT-RESPONSE" do
      expect(strategy.response_header_name).to eq("X-PAYMENT-RESPONSE")
    end
  end

  describe "#requirement_header_name" do
    it "returns nil" do
      expect(strategy.requirement_header_name).to be_nil
    end
  end

  describe "#format_network" do
    it "returns the network as-is" do
      expect(strategy.format_network("base-sepolia")).to eq("base-sepolia")
    end

    it "does not convert to CAIP-2 format" do
      expect(strategy.format_network("base")).to eq("base")
    end
  end

  describe "#parse_network" do
    it "returns the network as-is" do
      expect(strategy.parse_network("base-sepolia")).to eq("base-sepolia")
    end

    it "does not parse CAIP-2 format" do
      expect(strategy.parse_network("eip155:84532")).to eq("eip155:84532")
    end
  end

  describe "#format_requirement" do
    let(:requirement) do
      {
        scheme: "exact",
        network: "base-sepolia",
        amount: 1000,
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        pay_to: "0xRecipientWallet",
        resource: "/api/weather",
        description: "Payment required for /api/weather",
        max_timeout_seconds: 600,
        mime_type: "application/json",
        extra: { name: "USDC", version: "2" }
      }
    end

    it "formats with maxAmountRequired field" do
      result = strategy.format_requirement(requirement)
      expect(result[:maxAmountRequired]).to eq("1000")
    end

    it "does not include amount field" do
      result = strategy.format_requirement(requirement)
      expect(result).not_to have_key(:amount)
    end

    it "includes resource in requirement" do
      result = strategy.format_requirement(requirement)
      expect(result[:resource]).to eq("/api/weather")
    end

    it "includes description in requirement" do
      result = strategy.format_requirement(requirement)
      expect(result[:description]).to eq("Payment required for /api/weather")
    end

    it "includes mimeType in requirement" do
      result = strategy.format_requirement(requirement)
      expect(result[:mimeType]).to eq("application/json")
    end

    it "uses internal network format" do
      result = strategy.format_requirement(requirement)
      expect(result[:network]).to eq("base-sepolia")
    end

    it "includes all standard fields" do
      result = strategy.format_requirement(requirement)
      expect(result).to include(
        scheme: "exact",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0xRecipientWallet",
        maxTimeoutSeconds: 600,
        extra: { name: "USDC", version: "2" }
      )
    end
  end

  describe "#format_requirement_response" do
    let(:accepts) do
      [
        {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "1000",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          payTo: "0xRecipientWallet"
        }
      ]
    end

    let(:resource) do
      {
        url: "/api/weather",
        description: "Payment required for /api/weather",
        mime_type: "application/json"
      }
    end

    it "returns x402Version as 1" do
      result = strategy.format_requirement_response(
        accepts: accepts,
        resource: resource,
        error: "Payment required"
      )
      expect(result[:x402Version]).to eq(1)
    end

    it "includes error message" do
      result = strategy.format_requirement_response(
        accepts: accepts,
        resource: resource,
        error: "Payment required"
      )
      expect(result[:error]).to eq("Payment required")
    end

    it "includes accepts array" do
      result = strategy.format_requirement_response(
        accepts: accepts,
        resource: resource,
        error: "Payment required"
      )
      expect(result[:accepts]).to eq(accepts)
    end

    it "does not include resource at top level" do
      result = strategy.format_requirement_response(
        accepts: accepts,
        resource: resource,
        error: "Payment required"
      )
      expect(result).not_to have_key(:resource)
    end
  end
end
