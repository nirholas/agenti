# frozen_string_literal: true

require_relative "versions/base"
require_relative "versions/v1"
require_relative "versions/v2"

module X402
  module Versions
    def self.for(version)
      case version.to_i
      when 1 then V1.new
      when 2 then V2.new
      else raise ConfigurationError, "Unsupported x402 version: #{version}"
      end
    end
  end
end
