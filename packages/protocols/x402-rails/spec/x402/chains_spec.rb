# frozen_string_literal: true

RSpec.describe X402, "chains" do
  describe "CHAINS constant" do
    it "is frozen" do
      expect(X402::CHAINS).to be_frozen
    end

    it "includes base-sepolia configuration" do
      expect(X402::CHAINS["base-sepolia"]).to include(
        chain_id: 84532,
        usdc_address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        explorer_url: "https://sepolia.basescan.org"
      )
    end

    it "includes base mainnet configuration" do
      expect(X402::CHAINS["base"]).to include(
        chain_id: 8453,
        usdc_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        explorer_url: "https://basescan.org"
      )
    end

    it "includes avalanche-fuji configuration" do
      expect(X402::CHAINS["avalanche-fuji"]).to include(
        chain_id: 43113,
        usdc_address: "0x5425890298aed601595a70AB815c96711a31Bc65"
      )
    end

    it "includes avalanche mainnet configuration" do
      expect(X402::CHAINS["avalanche"]).to include(
        chain_id: 43114,
        usdc_address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
      )
    end
  end

  describe "CURRENCY_BY_CHAIN constant" do
    it "is frozen" do
      expect(X402::CURRENCY_BY_CHAIN).to be_frozen
    end

    it "includes configuration for all supported chains" do
      X402::CHAINS.keys.each do |chain_name|
        expect(X402::CURRENCY_BY_CHAIN).to have_key(chain_name)
      end
    end

    it "includes USDC configuration with decimals" do
      config = X402::CURRENCY_BY_CHAIN["base-sepolia"]
      expect(config).to include(
        symbol: "USDC",
        decimals: 6,
        version: "2"
      )
    end
  end

  describe ".chain_config" do
    it "returns configuration for supported chain" do
      config = X402.chain_config("base-sepolia")
      expect(config).to include(:chain_id, :usdc_address, :explorer_url)
    end

    it "raises error for unsupported chain" do
      expect { X402.chain_config("ethereum") }.to raise_error(
        X402::ConfigurationError,
        /Unsupported chain: ethereum/
      )
    end
  end

  describe ".currency_config_for_chain" do
    it "returns currency configuration for supported chain" do
      config = X402.currency_config_for_chain("base-sepolia")
      expect(config).to include(:symbol, :decimals, :name, :version)
    end

    it "raises error for unsupported chain" do
      expect { X402.currency_config_for_chain("unknown") }.to raise_error(
        X402::ConfigurationError,
        "Unsupported chain for currency: unknown"
      )
    end
  end

  describe ".supported_chains" do
    before { X402.reset_configuration! }

    it "returns array of supported chain names" do
      chains = X402.supported_chains
      expect(chains).to be_an(Array)
      expect(chains).to include("base-sepolia", "base", "avalanche-fuji", "avalanche")
    end

    it "includes built-in chain keys" do
      expect(X402.supported_chains).to include(*X402::CHAINS.keys)
    end

    it "includes custom chains" do
      X402.configure do |config|
        config.register_chain(name: "polygon", chain_id: 137)
      end

      expect(X402.supported_chains).to include("polygon")
    end
  end

  describe ".usdc_address_for" do
    it "returns USDC contract address for chain" do
      address = X402.usdc_address_for("base-sepolia")
      expect(address).to eq("0x036CbD53842c5426634e7929541eC2318f3dCF7e")
    end

    it "returns different addresses for different chains" do
      base_address = X402.usdc_address_for("base")
      avalanche_address = X402.usdc_address_for("avalanche")
      expect(base_address).not_to eq(avalanche_address)
    end

    it "returns nil for unsupported chain" do
      expect(X402.usdc_address_for("polygon")).to be_nil
    end
  end

  describe ".currency_decimals_for_chain" do
    it "returns decimals for supported chain" do
      decimals = X402.currency_decimals_for_chain("base-sepolia")
      expect(decimals).to eq(6)
    end

    it "returns same decimals for all built-in USDC chains" do
      X402::CHAINS.keys.each do |chain|
        expect(X402.currency_decimals_for_chain(chain)).to eq(6)
      end
    end

    it "raises error for unsupported chain" do
      expect { X402.currency_decimals_for_chain("unknown") }.to raise_error(X402::ConfigurationError)
    end
  end

  describe ".to_caip2" do
    before { X402.reset_configuration! }

    it "converts built-in chains to CAIP-2 format" do
      expect(X402.to_caip2("base-sepolia")).to eq("eip155:84532")
      expect(X402.to_caip2("base")).to eq("eip155:8453")
      expect(X402.to_caip2("avalanche")).to eq("eip155:43114")
    end

    it "converts custom chains to CAIP-2 format" do
      X402.configure do |config|
        config.register_chain(name: "polygon", chain_id: 137)
      end

      expect(X402.to_caip2("polygon")).to eq("eip155:137")
    end

    it "raises error for unknown chain" do
      expect { X402.to_caip2("unknown") }.to raise_error(X402::ConfigurationError)
    end
  end

  describe ".from_caip2" do
    before { X402.reset_configuration! }

    it "converts built-in CAIP-2 format to chain name" do
      expect(X402.from_caip2("eip155:84532")).to eq("base-sepolia")
      expect(X402.from_caip2("eip155:8453")).to eq("base")
      expect(X402.from_caip2("eip155:43114")).to eq("avalanche")
    end

    it "converts custom chain CAIP-2 format to chain name" do
      X402.configure do |config|
        config.register_chain(name: "polygon", chain_id: 137)
        config.register_chain(name: "polygon-amoy", chain_id: 80002)
      end

      expect(X402.from_caip2("eip155:137")).to eq("polygon")
      expect(X402.from_caip2("eip155:80002")).to eq("polygon-amoy")
    end

    it "raises error for unknown CAIP-2 string" do
      expect { X402.from_caip2("eip155:999999") }.to raise_error(X402::ConfigurationError, /Unknown CAIP-2 network/)
    end
  end

  describe ".asset_address_for" do
    before { X402.reset_configuration! }

    it "returns USDC address for built-in chains by default" do
      expect(X402.asset_address_for("base-sepolia")).to eq("0x036CbD53842c5426634e7929541eC2318f3dCF7e")
    end

    it "returns custom token address when registered" do
      X402.configure do |config|
        config.register_token(
          chain: "base",
          symbol: "WETH",
          address: "0x4200000000000000000000000000000000000006",
          decimals: 18,
          name: "Wrapped Ether"
        )
        config.currency = "WETH"
      end

      expect(X402.asset_address_for("base")).to eq("0x4200000000000000000000000000000000000006")
    end

    it "allows specifying symbol explicitly" do
      X402.configure do |config|
        config.register_token(
          chain: "base",
          symbol: "WETH",
          address: "0x4200000000000000000000000000000000000006",
          decimals: 18,
          name: "Wrapped Ether"
        )
      end

      expect(X402.asset_address_for("base", "WETH")).to eq("0x4200000000000000000000000000000000000006")
      expect(X402.asset_address_for("base", "USDC")).to eq("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
    end

    it "raises error for unknown token" do
      expect { X402.asset_address_for("base", "UNKNOWN") }.to raise_error(X402::ConfigurationError, /Unknown token/)
    end
  end

  describe ".token_config_for" do
    before { X402.reset_configuration! }

    it "returns built-in USDC config by default" do
      config = X402.token_config_for("base-sepolia")
      expect(config[:symbol]).to eq("USDC")
      expect(config[:decimals]).to eq(6)
    end

    it "returns custom token config when registered" do
      X402.configure do |config|
        config.register_token(
          chain: "base",
          symbol: "WETH",
          address: "0x4200000000000000000000000000000000000006",
          decimals: 18,
          name: "Wrapped Ether",
          version: "1"
        )
        config.currency = "WETH"
      end

      config = X402.token_config_for("base")
      expect(config[:symbol]).to eq("WETH")
      expect(config[:decimals]).to eq(18)
      expect(config[:name]).to eq("Wrapped Ether")
    end

    it "raises error for unknown token" do
      expect { X402.token_config_for("base", "UNKNOWN") }.to raise_error(X402::ConfigurationError)
    end
  end

  describe "custom chain integration" do
    before { X402.reset_configuration! }

    it "allows using a fully custom chain and token" do
      X402.configure do |config|
        config.wallet_address = "0x1234567890abcdef1234567890abcdef12345678"
        config.register_chain(name: "polygon", chain_id: 137)
        config.register_token(
          chain: "polygon",
          symbol: "USDC",
          address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
          decimals: 6,
          name: "USD Coin",
          version: "2"
        )
        config.chain = "polygon"
        config.currency = "USDC"
      end

      expect(X402.to_caip2("polygon")).to eq("eip155:137")
      expect(X402.asset_address_for("polygon")).to eq("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359")

      token_config = X402.token_config_for("polygon")
      expect(token_config[:decimals]).to eq(6)
      expect(token_config[:name]).to eq("USD Coin")
    end
  end
end
