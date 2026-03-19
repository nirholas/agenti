# frozen_string_literal: true

module X402
  module Versions
    class V1 < Base
      def version_number
        1
      end

      def payment_header_name
        "X-PAYMENT"
      end

      def response_header_name
        "X-PAYMENT-RESPONSE"
      end

      def requirement_header_name
        nil
      end

      def format_network(internal_network)
        internal_network
      end

      def parse_network(network)
        network
      end

      def format_requirement(requirement)
        {
          scheme: requirement[:scheme],
          network: format_network(requirement[:network]),
          maxAmountRequired: requirement[:amount].to_s,
          asset: requirement[:asset],
          payTo: requirement[:pay_to],
          resource: requirement[:resource],
          description: requirement[:description],
          maxTimeoutSeconds: requirement[:max_timeout_seconds],
          mimeType: requirement[:mime_type],
          extra: requirement[:extra]
        }.compact
      end

      def format_requirement_response(accepts:, resource:, error:)
        {
          x402Version: 1,
          error: error,
          accepts: accepts
        }
      end
    end
  end
end
