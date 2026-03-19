# frozen_string_literal: true

RSpec.describe X402::Versions::V2 do
  let(:strategy) { described_class.new }

  describe "#version_number" do
    it "returns 2" do
      expect(strategy.version_number).to eq(2)
    end
  end

  describe "#payment_header_name" do
    it "returns PAYMENT-SIGNATURE" do
      expect(strategy.payment_header_name).to eq("PAYMENT-SIGNATURE")
    end
  end

  describe "#response_header_name" do
    it "returns PAYMENT-RESPONSE" do
      expect(strategy.response_header_name).to eq("PAYMENT-RESPONSE")
    end
  end

  describe "#requirement_header_name" do
    it "returns PAYMENT-REQUIRED" do
      expect(strategy.requirement_header_name).to eq("PAYMENT-REQUIRED")
    end
  end

  describe "#format_network" do
    it "converts base-sepolia to CAIP-2 format" do
      expect(strategy.format_network("base-sepolia")).to eq("eip155:84532")
    end

    it "converts base to CAIP-2 format" do
      expect(strategy.format_network("base")).to eq("eip155:8453")
    end

    it "converts solana-devnet to CAIP-2 format" do
      expect(strategy.format_network("solana-devnet")).to eq("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
    end
  end

  describe "#parse_network" do
    it "converts CAIP-2 format to internal format" do
      expect(strategy.parse_network("eip155:84532")).to eq("base-sepolia")
    end

    it "converts base CAIP-2 to internal format" do
      expect(strategy.parse_network("eip155:8453")).to eq("base")
    end

    it "returns network as-is if not CAIP-2 format" do
      expect(strategy.parse_network("base-sepolia")).to eq("base-sepolia")
    end

    it "handles Solana CAIP-2 format" do
      expect(strategy.parse_network("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).to eq("solana-devnet")
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

    it "formats with amount field" do
      result = strategy.format_requirement(requirement)
      expect(result[:amount]).to eq("1000")
    end

    it "does not include maxAmountRequired field" do
      result = strategy.format_requirement(requirement)
      expect(result).not_to have_key(:maxAmountRequired)
    end

    it "does not include resource in requirement" do
      result = strategy.format_requirement(requirement)
      expect(result).not_to have_key(:resource)
    end

    it "does not include description in requirement" do
      result = strategy.format_requirement(requirement)
      expect(result).not_to have_key(:description)
    end

    it "does not include mimeType in requirement" do
      result = strategy.format_requirement(requirement)
      expect(result).not_to have_key(:mimeType)
    end

    it "converts network to CAIP-2 format" do
      result = strategy.format_requirement(requirement)
      expect(result[:network]).to eq("eip155:84532")
    end

    it "includes standard fields" do
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
          network: "eip155:84532",
          amount: "1000",
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

    it "returns x402Version as 2" do
      result = strategy.format_requirement_response(
        accepts: accepts,
        resource: resource,
        error: "Payment required"
      )
      expect(result[:x402Version]).to eq(2)
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

    it "includes resource at top level" do
      result = strategy.format_requirement_response(
        accepts: accepts,
        resource: resource,
        error: "Payment required"
      )
      expect(result[:resource]).to include(
        url: "/api/weather",
        description: "Payment required for /api/weather",
        mimeType: "application/json"
      )
    end

    it "includes empty extensions object" do
      result = strategy.format_requirement_response(
        accepts: accepts,
        resource: resource,
        error: "Payment required"
      )
      expect(result[:extensions]).to eq({})
    end
  end
end
