# frozen_string_literal: true

module X402
  class SettlementResponse
    attr_accessor :success, :transaction, :network, :payer, :error_reason

    def initialize(attributes = {})
      @success = attributes[:success] || attributes["success"]
      @transaction = attributes[:transaction] || attributes["transaction"]
      @network = attributes[:network] || attributes["network"]
      @payer = attributes[:payer] || attributes["payer"]
      @error_reason = attributes[:error_reason] || attributes["errorReason"]
    end

    def success?
      success == true
    end

    def to_h
      {
        success: success,
        transaction: transaction,
        network: network,
        payer: payer,
        errorReason: error_reason
      }
    end

    def to_json(*args)
      to_h.to_json(*args)
    end

    def to_base64
      Base64.strict_encode64(to_json)
    end
  end
end
