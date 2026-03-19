# frozen_string_literal: true

module X402
  module Rails
    class Railtie < ::Rails::Railtie
      initializer "x402.controller_extensions" do
        ActiveSupport.on_load(:action_controller) do
          include X402::Rails::ControllerExtensions
        end
      end

      initializer "x402.configuration" do
        # Configuration will be loaded from initializers/x402.rb if present
      end
    end
  end
end
