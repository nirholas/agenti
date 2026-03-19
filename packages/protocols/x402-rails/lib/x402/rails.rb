# frozen_string_literal: true

require "active_support"
require "active_job"
require "action_controller"
require "json"
require "base64"

require_relative "rails/version"
require_relative "../x402/configuration"
require_relative "../x402/chains"
require_relative "../x402/versions"
require_relative "../x402/payment_requirement"
require_relative "../x402/payment_payload"
require_relative "../x402/settlement_response"
require_relative "../x402/facilitator_client"
require_relative "../x402/payment_validator"
require_relative "../x402/requirement_generator"
require_relative "../x402/rails/controller_extensions"
require_relative "../x402/rails/railtie" if defined?(::Rails::Railtie)

module X402
  module Rails
    class Error < StandardError; end
  end
end
