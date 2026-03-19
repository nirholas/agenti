# frozen_string_literal: true

require "faraday"
require "json"

module X402
  class FacilitatorClient
    attr_reader :facilitator_url

    def initialize(facilitator_url = nil)
      @facilitator_url = facilitator_url || X402.configuration.facilitator
    end

    def verify(payment_payload, payment_requirements)
      request_body = {
        x402Version: payment_payload.x402_version,
        paymentPayload: payment_payload.to_h,
        paymentRequirements: payment_requirements
      }

      ::Rails.logger.info("=== X402 Verify Request ===")
      ::Rails.logger.info("URL: #{facilitator_url}/verify")
      ::Rails.logger.info("Request body: #{request_body.to_json}")

      response = connection.post("verify") do |req|
        req.headers["Content-Type"] = "application/json"
        req.body = request_body.to_json
      end

      ::Rails.logger.info("Response status: #{response.status}")
      ::Rails.logger.info("Response body: #{response.body}")

      handle_response(response, "verify")
    rescue Faraday::Error => e
      raise FacilitatorError, "Failed to verify payment: #{e.message}"
    end

    def settle(payment_payload, payment_requirements)
      request_body = {
        x402Version: payment_payload.x402_version,
        paymentPayload: payment_payload.to_h,
        paymentRequirements: payment_requirements
      }

      ::Rails.logger.info("=== X402 Settlement Request ===")
      ::Rails.logger.info("URL: #{facilitator_url}/settle")
      ::Rails.logger.info("Request body: #{request_body.to_json}")

      response = connection.post("settle") do |req|
        req.headers["Content-Type"] = "application/json"
        req.body = request_body.to_json
      end

      ::Rails.logger.info("Response status: #{response.status}")
      ::Rails.logger.info("Response body: #{response.body}")

      settlement_data = handle_response(response, "settle")
      SettlementResponse.new(settlement_data)
    rescue Faraday::Error => e
      raise FacilitatorError, "Failed to settle payment: #{e.message}"
    end

    def supported_networks
      response = connection.get("supported")
      handle_response(response, "supported")
    rescue Faraday::Error => e
      raise FacilitatorError, "Failed to fetch supported networks: #{e.message}"
    end

    private

    def connection
      @connection ||= Faraday.new(url: facilitator_url) do |faraday|
        faraday.adapter Faraday.default_adapter
      end
    end

    def handle_response(response, action)
      case response.status
      when 200..299
        JSON.parse(response.body)
      when 400
        error_body = JSON.parse(response.body) rescue {}
        raise InvalidPaymentError, "Invalid payment: #{error_body['error'] || response.body}"
      when 500..599
        raise FacilitatorError, "Facilitator error (#{action}): #{response.status}"
      else
        raise FacilitatorError, "Unexpected response (#{action}): #{response.status}"
      end
    rescue JSON::ParserError => e
      raise FacilitatorError, "Failed to parse facilitator response: #{e.message}"
    end
  end

  class FacilitatorError < StandardError; end
  class InvalidPaymentError < StandardError; end
end
