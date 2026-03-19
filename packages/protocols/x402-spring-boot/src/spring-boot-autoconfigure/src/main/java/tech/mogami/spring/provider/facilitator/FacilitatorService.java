package tech.mogami.spring.provider.facilitator;

import reactor.core.publisher.Mono;
import tech.mogami.commons.api.facilitator.settle.SettlementResponse;
import tech.mogami.commons.api.facilitator.supported.SupportedResponse;
import tech.mogami.commons.api.facilitator.verify.VerificationResponse;
import tech.mogami.commons.payment.PaymentPayload;
import tech.mogami.commons.payment.PaymentRequirements;

/**
 * FacilitatorClient is a client for the external facilitator.
 */
public interface FacilitatorService {

    /**
     * Retrieve the supported payment methods from the facilitator service.
     *
     * @return a Mono of SupportedResponse
     */
    Mono<SupportedResponse> supported();

    /**
     * Verify the payment with the facilitator service.
     *
     * @param paymentPayload      payment payload received from the user
     * @param paymentRequirements payment requirements
     * @return status
     */
    Mono<VerificationResponse> verify(PaymentPayload paymentPayload,
                                      PaymentRequirements paymentRequirements);

    /**
     * Settle the payment with the facilitator service.
     *
     * @param paymentPayload      payment payload received from the user
     * @param paymentRequirements payment requirements
     * @return status
     */
    Mono<SettlementResponse> settle(PaymentPayload paymentPayload,
                                    PaymentRequirements paymentRequirements);

}
