# frozen_string_literal: true

module X402
  module Versions
    class V2 < Base
      def version_number
        2
      end

      def payment_header_name
        "PAYMENT-SIGNATURE"
      end

      def response_header_name
        "PAYMENT-RESPONSE"
      end

      def requirement_header_name
        "PAYMENT-REQUIRED"
      end

      def format_network(internal_network)
        X402.to_caip2(internal_network)
      end

      def parse_network(network)
        if network.include?(":")
          X402.from_caip2(network)
        else
          network
        end
      end

      def format_requirement(requirement)
        {
          scheme: requirement[:scheme],
          network: format_network(requirement[:network]),
          amount: requirement[:amount].to_s,
          asset: requirement[:asset],
          payTo: requirement[:pay_to],
          maxTimeoutSeconds: requirement[:max_timeout_seconds],
          extra: requirement[:extra]
        }.compact
      end

      def format_requirement_response(accepts:, resource:, error:)
        {
          x402Version: 2,
          error: error,
          resource: {
            url: resource[:url],
            description: resource[:description],
            mimeType: resource[:mime_type]
          }.compact,
          accepts: accepts,
          extensions: {}
        }
      end
    end
  end
end
