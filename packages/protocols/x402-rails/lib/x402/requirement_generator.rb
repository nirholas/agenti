# frozen_string_literal: true

module X402
  class RequirementGenerator
    def self.generate(amount:, resource:, description: nil, chain: nil, currency: nil,
                      wallet_address: nil, fee_payer: nil, version: nil, accepts: nil)
      config = X402.configuration
      protocol_version = version || config.version
      version_strategy = X402::Versions.for(protocol_version)

      accepted_payments = resolve_accepted_payments(
        accepts: accepts,
        chain: chain,
        currency: currency
      )

      formatted_accepts = accepted_payments.map do |payment|
        build_formatted_requirement(
          amount: amount,
          resource: resource,
          description: description,
          chain: payment[:chain],
          currency: payment[:currency],
          wallet_address: wallet_address || payment[:wallet_address] || config.wallet_address,
          fee_payer: fee_payer,
          version_strategy: version_strategy
        )
      end

      version_strategy.format_requirement_response(
        accepts: formatted_accepts,
        resource: {
          url: resource,
          description: description || "Payment required for #{resource}",
          mime_type: "application/json"
        },
        error: "Payment required to access this resource"
      )
    end

    def self.build_formatted_requirement(amount:, resource:, description:, chain:, currency:,
                                         wallet_address:, fee_payer:, version_strategy:)
      token_config = X402.token_config_for(chain, currency)
      asset_address = X402.asset_address_for(chain, currency)
      atomic_amount = convert_to_atomic(amount, token_config[:decimals])
      extra_data = build_extra_data(chain, token_config, fee_payer)

      internal_requirement = {
        scheme: "exact",
        network: chain,
        amount: atomic_amount,
        asset: asset_address,
        pay_to: wallet_address,
        resource: resource,
        description: description || "Payment required for #{resource}",
        max_timeout_seconds: 600,
        mime_type: "application/json",
        extra: extra_data
      }

      version_strategy.format_requirement(internal_requirement)
    end

    def self.resolve_accepted_payments(accepts:, chain:, currency:)
      config = X402.configuration

      if accepts && !accepts.empty?
        accepts.map do |acc|
          {
            chain: acc[:chain],
            currency: acc[:currency] || "USDC",
            wallet_address: acc[:wallet_address]
          }
        end
      elsif chain
        [{ chain: chain, currency: currency || config.currency, wallet_address: nil }]
      else
        config.effective_accepted_payments
      end
    end

    def self.convert_to_atomic(amount, decimals)
      (amount.to_f * (10**decimals)).to_i
    end

    def self.build_extra_data(chain_name, token_config, fee_payer_override)
      if X402.solana_chain?(chain_name)
        fee_payer = fee_payer_override || X402.fee_payer_for(chain_name)
        { feePayer: fee_payer }
      else
        {
          name: token_config[:name],
          version: token_config[:version]
        }
      end
    end
  end
end
