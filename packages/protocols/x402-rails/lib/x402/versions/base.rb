# frozen_string_literal: true

module X402
  module Versions
    class Base
      def version_number
        raise NotImplementedError
      end

      def payment_header_name
        raise NotImplementedError
      end

      def response_header_name
        raise NotImplementedError
      end

      def requirement_header_name
        raise NotImplementedError
      end

      def format_network(internal_network)
        raise NotImplementedError
      end

      def parse_network(network)
        raise NotImplementedError
      end

      def format_requirement(requirement)
        raise NotImplementedError
      end

      def format_requirement_response(accepts:, resource:, error:)
        raise NotImplementedError
      end
    end
  end
end
