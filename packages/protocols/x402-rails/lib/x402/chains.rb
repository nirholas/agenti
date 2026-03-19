# frozen_string_literal: true

module X402
  # Chain configurations for supported networks
  CHAINS = {
    "base-sepolia" => {
      chain_id: 84532,
      usdc_address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      explorer_url: "https://sepolia.basescan.org"
    },
    "base" => {
      chain_id: 8453,
      usdc_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      explorer_url: "https://basescan.org"
    },
    "avalanche-fuji" => {
      chain_id: 43113,
      usdc_address: "0x5425890298aed601595a70AB815c96711a31Bc65",
      explorer_url: "https://testnet.snowtrace.io"
    },
    "avalanche" => {
      chain_id: 43114,
      usdc_address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      explorer_url: "https://snowtrace.io"
    },
    "solana-devnet" => {
      chain_id: 103,
      usdc_address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      explorer_url: "https://explorer.solana.com/?cluster=devnet",
      fee_payer: "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
    },
    "solana" => {
      chain_id: 101,
      usdc_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      explorer_url: "https://explorer.solana.com",
      fee_payer: "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
    }
  }.freeze

  # Currency configurations by chain
  CURRENCY_BY_CHAIN = {
    "base-sepolia" => {
      symbol: "USDC",
      decimals: 6,
      name: "USDC",  # Testnet uses "USDC"
      version: "2"
    },
    "base" => {
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",  # Mainnet uses "USD Coin"
      version: "2"
    },
    "avalanche-fuji" => {
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",  # Testnet uses "USD Coin"
      version: "2"
    },
    "avalanche" => {
      symbol: "USDC",
      decimals: 6,
      name: "USDC",  # Mainnet uses "USDC"
      version: "2"
    },
    "solana-devnet" => {
      symbol: "USDC",
      decimals: 6,
      name: "USDC",
      version: nil
    },
    "solana" => {
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      version: nil
    }
  }.freeze

  CAIP2_MAPPING = {
    "base-sepolia" => "eip155:84532",
    "base" => "eip155:8453",
    "avalanche-fuji" => "eip155:43113",
    "avalanche" => "eip155:43114",
    "solana-devnet" => "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "solana" => "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
  }.freeze

  REVERSE_CAIP2_MAPPING = CAIP2_MAPPING.invert.freeze

  class << self
    def chain_config(chain_name)
      custom = X402.configuration.chain_config(chain_name)
      return custom if custom

      CHAINS[chain_name] || raise(ConfigurationError, "Unsupported chain: #{chain_name}. Register with config.register_chain()")
    end

    def currency_config_for_chain(chain_name)
      CURRENCY_BY_CHAIN[chain_name] || raise(ConfigurationError, "Unsupported chain for currency: #{chain_name}")
    end

    def supported_chains
      CHAINS.keys + X402.configuration.custom_chains.keys
    end

    def usdc_address_for(chain_name)
      builtin = CHAINS[chain_name]
      builtin ? builtin[:usdc_address] : nil
    end

    def asset_address_for(chain_name, symbol = nil)
      symbol ||= X402.configuration.currency

      custom = X402.configuration.token_config(chain_name, symbol)
      return custom[:address] if custom

      if symbol.upcase == "USDC"
        builtin = CHAINS[chain_name]
        return builtin[:usdc_address] if builtin && builtin[:usdc_address]
      end

      raise ConfigurationError, "Unknown token #{symbol} for chain #{chain_name}. Register with config.register_token()"
    end

    def token_config_for(chain_name, symbol = nil)
      symbol ||= X402.configuration.currency

      custom = X402.configuration.token_config(chain_name, symbol)
      return custom if custom

      if symbol.upcase == "USDC" && CURRENCY_BY_CHAIN[chain_name]
        currency_config_for_chain(chain_name)
      else
        raise ConfigurationError, "Unknown token #{symbol} for chain #{chain_name}. Register with config.register_token()"
      end
    end

    def currency_decimals_for_chain(chain_name)
      currency_config_for_chain(chain_name)[:decimals]
    end

    def fee_payer_for(chain_name)
      # Priority: 1) Programmatic config, 2) Per-chain ENV variable, 3) Generic ENV variable, 4) Default from CHAINS
      config = X402.configuration

      # Check programmatic configuration
      return config.fee_payer if config.fee_payer && !config.fee_payer.empty?

      # Check per-chain environment variable (e.g., X402_SOLANA_DEVNET_FEE_PAYER, X402_SOLANA_FEE_PAYER)
      env_var_name = "X402_#{chain_name.upcase.gsub('-', '_')}_FEE_PAYER"
      env_fee_payer = ENV[env_var_name]
      return env_fee_payer if env_fee_payer && !env_fee_payer.empty?

      # Check generic environment variable
      env_fee_payer = ENV["X402_FEE_PAYER"]
      return env_fee_payer if env_fee_payer && !env_fee_payer.empty?

      # Fall back to default from chain config
      chain_config(chain_name)[:fee_payer]
    end

    def to_caip2(network_name)
      custom = X402.configuration.chain_config(network_name)
      if custom
        return "#{custom[:standard]}:#{custom[:chain_id]}"
      end

      CAIP2_MAPPING[network_name] || raise(ConfigurationError, "No CAIP-2 mapping for: #{network_name}")
    end

    def from_caip2(caip2_string)
      return REVERSE_CAIP2_MAPPING[caip2_string] if REVERSE_CAIP2_MAPPING[caip2_string]

      X402.configuration.custom_chains.each do |name, config|
        caip2 = "#{config[:standard]}:#{config[:chain_id]}"
        return name if caip2 == caip2_string
      end

      raise(ConfigurationError, "Unknown CAIP-2 network: #{caip2_string}")
    end

    SOLANA_CHAINS = %w[solana solana-devnet].freeze

    def solana_chain?(chain_name)
      SOLANA_CHAINS.include?(chain_name)
    end
  end
end
