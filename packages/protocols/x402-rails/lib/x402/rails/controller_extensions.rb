# frozen_string_literal: true

module X402
  module Rails
    module ControllerExtensions
      extend ActiveSupport::Concern

      included do
        after_action :settle_x402_payment_if_needed
      end

      def x402_paywall(options = {})
        amount = options[:amount] or raise ArgumentError, "amount is required"
        chain = options[:chain]
        currency = options[:currency]
        protocol_version = options[:version] || X402.configuration.version
        wallet_address = options[:wallet_address]
        fee_payer = options[:fee_payer]
        accepts = options[:accepts]

        begin
          version_strategy = X402::Versions.for(protocol_version)
        rescue X402::ConfigurationError => e
          return render_configuration_error(e.message)
        end

        payment_header = request.headers[version_strategy.payment_header_name]

        if payment_header.nil? || payment_header.empty?
          return render_payment_required(
            amount,
            chain: chain,
            currency: currency,
            version: protocol_version,
            wallet_address: wallet_address,
            fee_payer: fee_payer,
            accepts: accepts
          )
        end

        process_payment(
          payment_header, amount,
          chain: chain,
          currency: currency,
          version: protocol_version,
          wallet_address: wallet_address,
          fee_payer: fee_payer,
          accepts: accepts
        )
      end

      private

      def generate_payment_required_response(amount, error_message = nil,
                                              chain: nil, currency: nil, version: nil,
                                              wallet_address: nil, fee_payer: nil, accepts: nil)
        protocol_version = version || X402.configuration.version

        requirement_response = X402::RequirementGenerator.generate(
          amount: amount,
          resource: request.original_url,
          description: "Payment required for #{request.path}",
          chain: chain,
          currency: currency,
          version: protocol_version,
          wallet_address: wallet_address,
          fee_payer: fee_payer,
          accepts: accepts
        )
        requirement_response[:error] = error_message if error_message
        requirement_response
      end

      def render_payment_required(amount, chain: nil, currency: nil, version: nil,
                                   wallet_address: nil, fee_payer: nil, accepts: nil)
        protocol_version = version || X402.configuration.version
        version_strategy = X402::Versions.for(protocol_version)

        requirement_response = generate_payment_required_response(
          amount,
          chain: chain,
          currency: currency,
          version: protocol_version,
          wallet_address: wallet_address,
          fee_payer: fee_payer,
          accepts: accepts
        )

        render_402_response(requirement_response, version_strategy)
      end

      def render_402_response(requirement_response, version_strategy)
        if version_strategy.requirement_header_name
          response.headers[version_strategy.requirement_header_name] =
            Base64.strict_encode64(requirement_response.to_json)
        end
        render json: requirement_response, status: :payment_required
      end

      def render_configuration_error(message)
        # Use V1 as a safe fallback when version is invalid to avoid recursive errors
        fallback_strategy = X402::Versions::V1.new
        error_response = {
          x402Version: 1,
          error: "Configuration error: #{message}",
          accepts: []
        }
        render_402_response(error_response, fallback_strategy)
      end

      def process_payment(payment_header, amount, chain: nil, currency: nil,
                          version: nil, wallet_address: nil, fee_payer: nil, accepts: nil)
        protocol_version = version || X402.configuration.version
        version_strategy = X402::Versions.for(protocol_version)

        payment_payload = X402::PaymentPayload.from_header(payment_header)

        requirement_data = X402::RequirementGenerator.generate(
          amount: amount,
          resource: request.original_url,
          description: "Payment required for #{request.path}",
          chain: chain,
          currency: currency,
          version: protocol_version,
          wallet_address: wallet_address,
          fee_payer: fee_payer,
          accepts: accepts
        )

        matching_accept = find_matching_accept(requirement_data[:accepts], payment_payload, version_strategy)

        unless matching_accept
          requirement_response = generate_payment_required_response(
            amount, "Payment network not accepted: #{payment_payload.network}",
            chain: chain, currency: currency, version: protocol_version,
            wallet_address: wallet_address, fee_payer: fee_payer, accepts: accepts
          )
          return render_402_response(requirement_response, version_strategy)
        end

        resource_info = requirement_data[:resource] || {}
        additional_attrs = { version: protocol_version }
        additional_attrs[:resource] = resource_info[:url] if resource_info[:url]
        additional_attrs[:description] = resource_info[:description] if resource_info[:description]
        additional_attrs[:mime_type] = resource_info[:mimeType] if resource_info[:mimeType]
        requirement_attrs = matching_accept.merge(additional_attrs)
        requirement = X402::PaymentRequirement.new(requirement_attrs)

        validator = X402::PaymentValidator.new
        validation_result = validator.validate(payment_payload, requirement)

        unless validation_result[:valid]
          requirement_response = generate_payment_required_response(
            amount, validation_result[:error],
            chain: chain, currency: currency, version: protocol_version,
            wallet_address: wallet_address, fee_payer: fee_payer, accepts: accepts
          )
          return render_402_response(requirement_response, version_strategy)
        end

        request.env["x402.payment"] = {
          payer: validation_result[:payer],
          amount: payment_payload.value,
          network: payment_payload.network,
          payload: payment_payload,
          requirement: requirement,
          version: protocol_version
        }

        unless X402.configuration.optimistic
          settlement_result = settle_payment_now

          if settlement_result.nil? || !settlement_result.success?
            error_message = settlement_result&.error_reason || "Settlement failed"
            requirement_response = generate_payment_required_response(
              amount, "failed to settle payment: #{error_message}",
              chain: chain, currency: currency, version: protocol_version,
              wallet_address: wallet_address, fee_payer: fee_payer, accepts: accepts
            )
            return render_402_response(requirement_response, version_strategy)
          end
        end

      rescue X402::InvalidPaymentError => e
        requirement_response = generate_payment_required_response(
          amount, "Invalid payment: #{e.message}",
          chain: chain, currency: currency, version: protocol_version,
          wallet_address: wallet_address, fee_payer: fee_payer, accepts: accepts
        )
        render_402_response(requirement_response, version_strategy)
      rescue X402::FacilitatorError => e
        requirement_response = generate_payment_required_response(
          amount, "Verification error: #{e.message}",
          chain: chain, currency: currency, version: protocol_version,
          wallet_address: wallet_address, fee_payer: fee_payer, accepts: accepts
        )
        render_402_response(requirement_response, version_strategy)
      rescue X402::ConfigurationError => e
        render_configuration_error(e.message)
      end

      def find_matching_accept(accepts, payment_payload, version_strategy)
        payment_network = payment_payload.network

        accepts.find do |accept|
          accept_network = accept[:network]
          next false unless accept_network.present?

          if accept_network.to_s.include?(":")
            version_strategy.parse_network(accept_network) == payment_network
          else
            accept_network == payment_network
          end
        end
      end

      def settle_x402_payment_if_needed
        return unless X402.configuration.optimistic

        payment_info = request.env["x402.payment"]
        return unless payment_info

        return unless response.status >= 200 && response.status < 300

        perform_settlement(payment_info)
      end

      def settle_payment_now
        payment_info = request.env["x402.payment"]
        return unless payment_info

        ::Rails.logger.info("=== X402 Non-Optimistic Settlement (before response) ===")
        settlement_result = perform_settlement(payment_info)

        request.env["x402.settlement_result"] = settlement_result
        settlement_result
      end

      def perform_settlement(payment_info)
        begin
          ::Rails.logger.info("=== X402 Settlement Attempt ===")
          ::Rails.logger.info("Optimistic mode: #{X402.configuration.optimistic}")
          ::Rails.logger.info("Payment payload class: #{payment_info[:payload].class}")
          ::Rails.logger.info("Payment payload: #{payment_info[:payload].inspect}")
          ::Rails.logger.info("Requirement class: #{payment_info[:requirement].class}")
          ::Rails.logger.info("Requirement hash: #{payment_info[:requirement].to_h.inspect}")

          protocol_version = payment_info[:version] || X402.configuration.version
          version_strategy = X402::Versions.for(protocol_version)

          facilitator_client = X402::FacilitatorClient.new
          settlement_result = facilitator_client.settle(
            payment_info[:payload],
            payment_info[:requirement].to_h(version: protocol_version)
          )

          if settlement_result.success?
            response.headers[version_strategy.response_header_name] = settlement_result.to_base64
            ::Rails.logger.info("x402 settlement successful: #{settlement_result.transaction}")
          else
            ::Rails.logger.error("x402 settlement failed: #{settlement_result.error_reason}")
          end

          settlement_result
        rescue X402::FacilitatorError => e
          ::Rails.logger.error("x402 settlement error: #{e.message}")
          nil
        end
      end

    end
  end
end
