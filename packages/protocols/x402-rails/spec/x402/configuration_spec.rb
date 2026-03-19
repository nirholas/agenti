# frozen_string_literal: true

RSpec.describe X402::Configuration do
  after do
    X402.reset_configuration!
  end

  describe "#initialize" do
    it "sets default values from environment variables" do
      config = described_class.new
      expect(config.facilitator).to eq("https://www.x402.org/facilitator")
      expect(config.chain).to eq("base-sepolia")
      expect(config.currency).to eq("USDC")
      expect(config.optimistic).to be false
      expect(config.custom_chains).to eq({})
      expect(config.custom_tokens).to eq({})
    end

    it "reads wallet_address from environment" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("X402_WALLET_ADDRESS", nil).and_return("0x123")
      config = described_class.new
      expect(config.wallet_address).to eq("0x123")
    end

    it "parses optimistic as boolean" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("X402_OPTIMISTIC", "true").and_return("false")
      config = described_class.new
      expect(config.optimistic).to be false
    end
  end

  describe "#validate!" do
    let(:config) { described_class.new }

    it "raises error when wallet_address is nil" do
      config.wallet_address = nil
      expect { config.validate! }.to raise_error(X402::ConfigurationError, "wallet_address is required")
    end

    it "raises error when wallet_address is empty" do
      config.wallet_address = ""
      expect { config.validate! }.to raise_error(X402::ConfigurationError, "wallet_address is required")
    end

    it "raises error when facilitator is nil" do
      config.wallet_address = "0x123"
      config.facilitator = nil
      expect { config.validate! }.to raise_error(X402::ConfigurationError, "facilitator URL is required")
    end

    it "raises error when chain is empty" do
      config.wallet_address = "0x123"
      config.chain = ""
      expect { config.validate! }.to raise_error(X402::ConfigurationError, "chain is required")
    end

    it "raises error when currency is empty" do
      config.wallet_address = "0x123"
      config.currency = ""
      expect { config.validate! }.to raise_error(X402::ConfigurationError, "currency is required")
    end

    it "passes validation with all required fields" do
      config.wallet_address = "0x123"
      expect { config.validate! }.not_to raise_error
    end
  end

  describe "#register_chain" do
    let(:config) { described_class.new }

    it "registers a custom EVM chain" do
      config.register_chain(name: "polygon", chain_id: 137)

      chain = config.chain_config("polygon")
      expect(chain[:chain_id]).to eq(137)
      expect(chain[:standard]).to eq("eip155")
    end

    it "allows specifying standard" do
      config.register_chain(name: "polygon", chain_id: 137, standard: "eip155")

      chain = config.chain_config("polygon")
      expect(chain[:standard]).to eq("eip155")
    end

    it "raises error for non-EVM standard" do
      expect {
        config.register_chain(name: "custom-solana", chain_id: 999, standard: "solana")
      }.to raise_error(X402::ConfigurationError, /Only eip155/)
    end
  end

  describe "#register_token" do
    let(:config) { described_class.new }

    it "registers a custom token" do
      config.register_token(
        chain: "base",
        symbol: "WETH",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        name: "Wrapped Ether",
        version: "1"
      )

      token = config.token_config("base", "WETH")
      expect(token[:symbol]).to eq("WETH")
      expect(token[:address]).to eq("0x4200000000000000000000000000000000000006")
      expect(token[:decimals]).to eq(18)
      expect(token[:name]).to eq("Wrapped Ether")
      expect(token[:version]).to eq("1")
    end

    it "raises error for Solana chains" do
      expect {
        config.register_token(
          chain: "solana-devnet",
          symbol: "BONK",
          address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
          decimals: 5,
          name: "Bonk",
          version: "1"
        )
      }.to raise_error(X402::ConfigurationError, /only supported on EVM chains/)
    end

    it "uses default version of 1" do
      config.register_token(
        chain: "base",
        symbol: "WETH",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        name: "Wrapped Ether"
      )

      token = config.token_config("base", "WETH")
      expect(token[:version]).to eq("1")
    end
  end

  describe "#accept" do
    let(:config) { described_class.new }

    it "adds a payment option to accepted_payments" do
      config.accept(chain: "base-sepolia", currency: "USDC")

      expect(config.accepted_payments.size).to eq(1)
      expect(config.accepted_payments.first).to eq({
        chain: "base-sepolia",
        currency: "USDC",
        wallet_address: nil
      })
    end

    it "allows multiple accepted payment options" do
      config.accept(chain: "base-sepolia", currency: "USDC")
      config.accept(chain: "polygon-amoy", currency: "USDC")

      expect(config.accepted_payments.size).to eq(2)
      expect(config.accepted_payments[0][:chain]).to eq("base-sepolia")
      expect(config.accepted_payments[1][:chain]).to eq("polygon-amoy")
    end

    it "defaults currency to USDC" do
      config.accept(chain: "base-sepolia")

      expect(config.accepted_payments.first[:currency]).to eq("USDC")
    end

    it "allows specifying wallet_address per payment option" do
      config.accept(chain: "base-sepolia", wallet_address: "0xCustomWallet")

      expect(config.accepted_payments.first[:wallet_address]).to eq("0xCustomWallet")
    end
  end

  describe "#effective_accepted_payments" do
    let(:config) { described_class.new }

    it "returns accepted_payments when configured" do
      config.accept(chain: "base-sepolia")
      config.accept(chain: "polygon-amoy")

      result = config.effective_accepted_payments
      expect(result.size).to eq(2)
    end

    it "falls back to default chain/currency when no accepts configured" do
      config.chain = "base"
      config.currency = "USDC"

      result = config.effective_accepted_payments
      expect(result).to eq([{ chain: "base", currency: "USDC", wallet_address: nil }])
    end
  end
end

RSpec.describe X402 do
  after do
    X402.reset_configuration!
  end

  describe ".configuration" do
    it "returns a Configuration instance" do
      expect(X402.configuration).to be_a(X402::Configuration)
    end

    it "returns the same instance on multiple calls" do
      config1 = X402.configuration
      config2 = X402.configuration
      expect(config1).to equal(config2)
    end
  end

  describe ".configure" do
    it "yields the configuration object" do
      expect { |b| X402.configure(&b) }.to yield_with_args(X402::Configuration)
    end

    it "allows setting configuration values" do
      X402.configure do |config|
        config.wallet_address = "0xtest"
        config.chain = "base"
        config.optimistic = false
      end

      expect(X402.configuration.wallet_address).to eq("0xtest")
      expect(X402.configuration.chain).to eq("base")
      expect(X402.configuration.optimistic).to be false
    end
  end

  describe ".reset_configuration!" do
    it "creates a new configuration instance" do
      old_config = X402.configuration
      X402.reset_configuration!
      new_config = X402.configuration
      expect(new_config).not_to equal(old_config)
    end

    it "resets configuration to defaults" do
      X402.configure do |config|
        config.wallet_address = "0xtest"
      end

      X402.reset_configuration!
      expect(X402.configuration.wallet_address).to be_nil
    end
  end
end
