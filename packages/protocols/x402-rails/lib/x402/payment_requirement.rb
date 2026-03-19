# frozen_string_literal: true

module X402
  class PaymentRequirement
    attr_accessor :scheme, :network, :amount, :asset, :pay_to, :resource, :description,
                  :max_timeout_seconds, :mime_type, :output_schema, :extra, :version

    def initialize(attributes = {})
      attrs = attributes.with_indifferent_access

      @scheme = attrs[:scheme] || "exact"
      @network = normalize_network(attrs[:network])
      @amount = attrs[:maxAmountRequired] || attrs[:max_amount_required] || attrs[:amount]
      @asset = attrs[:asset]
      @pay_to = attrs[:payTo] || attrs[:pay_to]
      @resource = attrs[:resource]
      @description = attrs[:description]
      @max_timeout_seconds = attrs[:maxTimeoutSeconds] || attrs[:max_timeout_seconds] || 600
      @mime_type = attrs[:mimeType] || attrs[:mime_type] || "application/json"
      @output_schema = attrs[:outputSchema] || attrs[:output_schema]
      @extra = attrs[:extra]
      @version = attrs[:version]
    end

    def max_amount_required
      @amount
    end

    def to_h(version: nil)
      v = version || @version || X402.configuration.version
      version_strategy = X402::Versions.for(v)

      version_strategy.format_requirement(
        scheme: scheme,
        network: network,
        amount: amount,
        asset: asset,
        pay_to: pay_to,
        resource: resource,
        description: description,
        max_timeout_seconds: max_timeout_seconds,
        mime_type: mime_type,
        extra: extra
      )
    end

    def to_json(*args)
      to_h.to_json(*args)
    end

    private

    def normalize_network(network_value)
      return network_value unless network_value

      if network_value.to_s.include?(":")
        X402.from_caip2(network_value)
      else
        network_value
      end
    rescue X402::ConfigurationError
      network_value
    end
  end
end
