# frozen_string_literal: true

module X402
  class PaymentValidator
    attr_reader :facilitator_client

    def initialize(facilitator_client = nil)
      @facilitator_client = facilitator_client || FacilitatorClient.new
    end

    def validate(payment_payload, requirement)
      # Validate scheme
      unless payment_payload.scheme == requirement.scheme
        return validation_error("Scheme mismatch: expected #{requirement.scheme}, got #{payment_payload.scheme}")
      end

      # Validate network
      unless payment_payload.network == requirement.network
        return validation_error("Network mismatch: expected #{requirement.network}, got #{payment_payload.network}")
      end

      # For EVM chains, validate recipient and amount locally before calling facilitator
      # For Solana chains, the facilitator handles all validation of the transaction
      if payment_payload.evm_chain?
        # Validate recipient address
        unless payment_payload.to_address&.downcase == requirement.pay_to&.downcase
          return validation_error("Recipient mismatch: expected #{requirement.pay_to}, got #{payment_payload.to_address}")
        end

        # Validate amount
        payment_value = payment_payload.value.to_i
        required_value = requirement.max_amount_required.to_i

        if payment_value < required_value
          return validation_error("Insufficient amount: expected at least #{required_value}, got #{payment_value}")
        end
      else
        # Solana: verify transaction payload exists
        unless payment_payload.transaction
          return validation_error("Solana payment missing transaction payload")
        end
      end

      # Call facilitator to verify payment (does NOT settle on blockchain yet)
      begin
        verify_result = facilitator_client.verify(payment_payload, requirement.to_h)

        unless verify_result["isValid"]
          return validation_error("Facilitator validation failed: #{verify_result['invalidReason']}")
        end

        if verify_result["payer"].nil?
          return validation_error("Verification failed: no payer address returned")
        end

        validation_success(verify_result["payer"], verify_result)
      rescue InvalidPaymentError => e
        validation_error("Facilitator validation failed: #{e.message}")
      rescue FacilitatorError => e
        validation_error("Facilitator error: #{e.message}")
      end
    end

    private

    def validation_success(payer_address, data = {})
      {
        valid: true,
        payer: payer_address,
        data: data
      }
    end

    def validation_error(message)
      {
        valid: false,
        error: message
      }
    end
  end
end
