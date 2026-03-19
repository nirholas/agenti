# frozen_string_literal: true

RSpec.describe X402::RequirementGenerator do
  before do
    X402.configure do |config|
      config.wallet_address = "0xRecipientWallet"
      config.chain = "base-sepolia"
      config.currency = "USDC"
    end
  end

  after do
    X402.reset_configuration!
  end

  describe ".generate" do
    let(:resource) { "/api/weather" }
    let(:amount) { 0.001 }

    context "with v2 (default)" do
      it "generates payment requirement with required fields" do
        result = described_class.generate(amount: amount, resource: resource)

        expect(result).to include(
          x402Version: 2,
          error: "Payment required to access this resource"
        )
        expect(result[:accepts]).to be_an(Array)
        expect(result[:accepts].size).to eq(1)
      end

      it "includes resource info at top level" do
        result = described_class.generate(amount: amount, resource: resource)

        expect(result[:resource]).to include(
          url: resource,
          description: "Payment required for /api/weather",
          mimeType: "application/json"
        )
      end

      it "sets the scheme to exact" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:scheme]).to eq("exact")
      end

      it "uses CAIP-2 network format" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:network]).to eq("eip155:84532")
      end

      it "uses amount field (not maxAmountRequired)" do
        result = described_class.generate(amount: 0.001, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:amount]).to eq("1000")
        expect(requirement).not_to have_key(:maxAmountRequired)
      end

      it "sets correct USDC contract address for chain" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:asset]).to eq("0x036CbD53842c5426634e7929541eC2318f3dCF7e")
      end

      it "sets pay_to from configuration" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:payTo]).to eq("0xRecipientWallet")
      end

      it "does not include resource in individual requirements" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement).not_to have_key(:resource)
        expect(requirement).not_to have_key(:description)
        expect(requirement).not_to have_key(:mimeType)
      end

      it "sets max_timeout_seconds" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:maxTimeoutSeconds]).to eq(600)
      end

      it "includes EIP-712 domain in extra field" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:extra]).to include(
          name: "USDC",
          version: "2"
        )
      end

      it "uses custom chain when provided" do
        result = described_class.generate(
          amount: amount,
          resource: resource,
          chain: "base"
        )
        requirement = result[:accepts].first

        expect(requirement[:network]).to eq("eip155:8453")
        expect(requirement[:asset]).to eq("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
      end

      it "uses correct currency name for mainnet" do
        result = described_class.generate(
          amount: amount,
          resource: resource,
          chain: "base"
        )
        requirement = result[:accepts].first

        expect(requirement[:extra][:name]).to eq("USD Coin")
      end
    end

    context "with v1 (legacy)" do
      before do
        X402.configuration.version = 1
      end

      it "generates payment requirement with v1 format" do
        result = described_class.generate(amount: amount, resource: resource)

        expect(result).to include(
          x402Version: 1,
          error: "Payment required to access this resource"
        )
      end

      it "uses internal network format" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:network]).to eq("base-sepolia")
      end

      it "uses maxAmountRequired field" do
        result = described_class.generate(amount: 0.001, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:maxAmountRequired]).to eq("1000")
        expect(requirement).not_to have_key(:amount)
      end

      it "includes resource in individual requirements" do
        result = described_class.generate(amount: amount, resource: resource)
        requirement = result[:accepts].first

        expect(requirement[:resource]).to eq(resource)
        expect(requirement[:description]).to eq("Payment required for /api/weather")
        expect(requirement[:mimeType]).to eq("application/json")
      end
    end

    context "with version override" do
      it "can use v1 format with version parameter" do
        result = described_class.generate(amount: amount, resource: resource, version: 1)

        expect(result[:x402Version]).to eq(1)
        expect(result[:accepts].first[:maxAmountRequired]).to eq("1000")
        expect(result[:accepts].first[:network]).to eq("base-sepolia")
      end

      it "can use v2 format with version parameter" do
        X402.configuration.version = 1
        result = described_class.generate(amount: amount, resource: resource, version: 2)

        expect(result[:x402Version]).to eq(2)
        expect(result[:accepts].first[:amount]).to eq("1000")
        expect(result[:accepts].first[:network]).to eq("eip155:84532")
      end
    end

    context "with Solana chains" do
      it "includes feePayer in extra field for Solana devnet" do
        result = described_class.generate(
          amount: amount,
          resource: resource,
          chain: "solana-devnet"
        )
        requirement = result[:accepts].first

        expect(requirement[:extra]).to include(feePayer: "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5")
        expect(requirement[:extra]).not_to have_key(:name)
        expect(requirement[:extra]).not_to have_key(:version)
      end

      it "uses CAIP-2 Solana network format in v2" do
        result = described_class.generate(
          amount: amount,
          resource: resource,
          chain: "solana-devnet"
        )
        requirement = result[:accepts].first

        expect(requirement[:network]).to eq("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
      end

      it "allows fee_payer override" do
        result = described_class.generate(
          amount: amount,
          resource: resource,
          chain: "solana-devnet",
          fee_payer: "CustomFeePayer123"
        )
        requirement = result[:accepts].first

        expect(requirement[:extra][:feePayer]).to eq("CustomFeePayer123")
      end
    end

    context "with wallet_address override" do
      it "uses provided wallet_address" do
        result = described_class.generate(
          amount: amount,
          resource: resource,
          wallet_address: "0xCustomWallet"
        )
        requirement = result[:accepts].first

        expect(requirement[:payTo]).to eq("0xCustomWallet")
      end
    end
  end

  describe ".convert_to_atomic" do
    it "converts USD to atomic units with 6 decimals" do
      expect(described_class.convert_to_atomic(0.001, 6)).to eq(1000)
      expect(described_class.convert_to_atomic(1.0, 6)).to eq(1_000_000)
      expect(described_class.convert_to_atomic(0.5, 6)).to eq(500_000)
    end

    it "handles different decimal places" do
      expect(described_class.convert_to_atomic(1.0, 18)).to eq(1_000_000_000_000_000_000)
      expect(described_class.convert_to_atomic(1.0, 2)).to eq(100)
    end

    it "handles very small amounts" do
      expect(described_class.convert_to_atomic(0.000001, 6)).to eq(1)
    end
  end

  describe ".generate with multiple accepted payments" do
    before do
      X402.configure do |config|
        config.wallet_address = "0xRecipientWallet"
        config.version = 2

        config.register_chain(name: "polygon-amoy", chain_id: 80002)
        config.register_token(
          chain: "polygon-amoy",
          symbol: "USDC",
          address: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
          decimals: 6,
          name: "USD Coin",
          version: "2"
        )

        config.accept(chain: "base-sepolia", currency: "USDC")
        config.accept(chain: "polygon-amoy", currency: "USDC")
      end
    end

    it "generates multiple accepts from config" do
      result = described_class.generate(
        amount: 0.001,
        resource: "http://example.com/api"
      )

      expect(result[:accepts].size).to eq(2)
      expect(result[:accepts][0][:network]).to eq("eip155:84532")
      expect(result[:accepts][1][:network]).to eq("eip155:80002")
    end

    it "uses same amount for all accepts" do
      result = described_class.generate(
        amount: 0.001,
        resource: "http://example.com/api"
      )

      result[:accepts].each do |accept|
        expect(accept[:amount]).to eq("1000")
      end
    end

    it "uses same wallet_address for all accepts" do
      result = described_class.generate(
        amount: 0.001,
        resource: "http://example.com/api"
      )

      result[:accepts].each do |accept|
        expect(accept[:payTo]).to eq("0xRecipientWallet")
      end
    end
  end

  describe ".generate with accepts parameter override" do
    before do
      X402.configure do |config|
        config.wallet_address = "0xRecipientWallet"
        config.version = 2
        config.chain = "base-sepolia"
      end
    end

    it "uses accepts parameter instead of config" do
      result = described_class.generate(
        amount: 0.001,
        resource: "http://example.com/api",
        accepts: [
          { chain: "base-sepolia", currency: "USDC" },
          { chain: "avalanche-fuji", currency: "USDC" }
        ]
      )

      expect(result[:accepts].size).to eq(2)
      expect(result[:accepts][0][:network]).to eq("eip155:84532")
      expect(result[:accepts][1][:network]).to eq("eip155:43113")
    end
  end

  describe ".resolve_accepted_payments" do
    before do
      X402.configure do |config|
        config.chain = "base-sepolia"
        config.currency = "USDC"
        config.accept(chain: "polygon-amoy", currency: "USDC")
      end
    end

    it "uses accepts parameter when provided" do
      result = described_class.resolve_accepted_payments(
        accepts: [{ chain: "avalanche", currency: "USDC" }],
        chain: nil,
        currency: nil
      )

      expect(result.size).to eq(1)
      expect(result.first[:chain]).to eq("avalanche")
    end

    it "uses chain parameter when no accepts" do
      result = described_class.resolve_accepted_payments(
        accepts: nil,
        chain: "base",
        currency: "USDC"
      )

      expect(result.size).to eq(1)
      expect(result.first[:chain]).to eq("base")
    end

    it "uses config.effective_accepted_payments when no accepts or chain" do
      result = described_class.resolve_accepted_payments(
        accepts: nil,
        chain: nil,
        currency: nil
      )

      expect(result.size).to eq(1)
      expect(result.first[:chain]).to eq("polygon-amoy")
    end
  end
end
