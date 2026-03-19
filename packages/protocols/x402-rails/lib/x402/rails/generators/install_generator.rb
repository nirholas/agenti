# frozen_string_literal: true

module X402
  module Rails
    module Generators
      class InstallGenerator < ::Rails::Generators::Base
        source_root File.expand_path("templates", __dir__)

        desc "Creates X402 initializer for your application"

        def copy_initializer
          template "x402_initializer.rb", "config/initializers/x402.rb"

          puts ""
          puts "✅ X402 initializer created at config/initializers/x402.rb"
          puts ""
          puts "Next steps:"
          puts "1. Set your X402_WALLET_ADDRESS environment variable"
          puts "2. Configure your preferred chain (base-sepolia for testing, base for production)"
          puts "3. Add x402_paywall(amount: 0.001) to any controller action"
          puts ""
          puts "Example usage:"
          puts "  def show"
          puts "    x402_paywall(amount: 0.001)  # $0.001 payment required"
          puts "    render json: @data"
          puts "  end"
          puts ""
        end
      end
    end
  end
end
