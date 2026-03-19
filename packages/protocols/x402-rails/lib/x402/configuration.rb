# frozen_string_literal: true

module X402
  class Configuration
    attr_accessor :wallet_address, :facilitator, :chain, :currency, :optimistic,
                  :version, :fee_payer, :custom_chains, :custom_tokens,
                  :accepted_payments

    def initialize
      @wallet_address = ENV.fetch("X402_WALLET_ADDRESS", nil)
      @facilitator = ENV.fetch("X402_FACILITATOR_URL", "https://www.x402.org/facilitator")
      @chain = ENV.fetch("X402_CHAIN", "base-sepolia")
      @currency = ENV.fetch("X402_CURRENCY", "USDC")
      @optimistic = ENV.fetch("X402_OPTIMISTIC", "false") == "true"
      @version = ENV.fetch("X402_VERSION", "2").to_i
      @fee_payer = ENV.fetch("X402_FEE_PAYER", nil)
      @custom_chains = {}
      @custom_tokens = {}
      @accepted_payments = []
    end

    def accept(chain:, currency: "USDC", wallet_address: nil)
      @accepted_payments << {
        chain: chain,
        currency: currency,
        wallet_address: wallet_address
      }
    end

    def effective_accepted_payments
      if @accepted_payments.empty?
        [{ chain: @chain, currency: @currency, wallet_address: nil }]
      else
        @accepted_payments
      end
    end

    def register_chain(name:, chain_id:, standard: "eip155")
      unless standard == "eip155"
        raise ConfigurationError, "Only eip155 (EVM) chains are supported for custom registration"
      end

      @custom_chains[name] = {
        chain_id: chain_id,
        standard: standard
      }
    end

    def register_token(chain:, symbol:, address:, decimals:, name:, version: "1")
      if chain.to_s.start_with?("solana")
        raise ConfigurationError, "Custom tokens are only supported on EVM chains"
      end

      key = "#{chain}:#{symbol}"
      @custom_tokens[key] = {
        symbol: symbol,
        address: address,
        decimals: decimals,
        name: name,
        version: version
      }
    end

    def chain_config(name)
      @custom_chains[name]
    end

    def token_config(chain, symbol)
      key = "#{chain}:#{symbol}"
      @custom_tokens[key]
    end

    def validate!
      raise ConfigurationError, "wallet_address is required" if wallet_address.nil? || wallet_address.empty?
      raise ConfigurationError, "facilitator URL is required" if facilitator.nil? || facilitator.empty?
      raise ConfigurationError, "chain is required" if chain.nil? || chain.empty?
      raise ConfigurationError, "currency is required" if currency.nil? || currency.empty?
      raise ConfigurationError, "version must be 1 or 2" unless [1, 2].include?(version)
    end
  end

  class << self
    attr_writer :configuration

    def configuration
      @configuration ||= Configuration.new
    end

    def configure
      yield(configuration)
    end

    def reset_configuration!
      @configuration = Configuration.new
    end
  end

  class ConfigurationError < StandardError; end
end
