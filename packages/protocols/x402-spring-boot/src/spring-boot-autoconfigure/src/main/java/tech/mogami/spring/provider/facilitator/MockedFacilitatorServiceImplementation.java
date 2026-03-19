package tech.mogami.spring.provider.facilitator;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import tech.mogami.commons.api.facilitator.settle.SettlementResponse;
import tech.mogami.commons.api.facilitator.supported.SupportedResponse;
import tech.mogami.commons.api.facilitator.verify.VerificationResponse;
import tech.mogami.commons.payment.PaymentPayload;
import tech.mogami.commons.payment.PaymentRequirements;
import tech.mogami.spring.parameter.X402Parameters;

import java.util.List;

import static tech.mogami.commons.constant.X402Error.INSUFFICIENT_FUNDS;
import static tech.mogami.commons.constant.X402Error.UNKNOWN;
import static tech.mogami.commons.constant.network.Networks.BASE_MAINNET;
import static tech.mogami.commons.constant.network.Networks.BASE_SEPOLIA;
import static tech.mogami.commons.constant.version.X402Versions.X402_SUPPORTED_VERSION_BY_MOGAMI;
import static tech.mogami.commons.payment.schemes.Schemes.EXACT_SCHEME;
import static tech.mogami.commons.test.BaseMogamiTestData.EMPTY_WALLET_ADDRESS;
import static tech.mogami.commons.test.BaseMogamiTestData.TEST_CLIENT_WALLET_ADDRESS_1;

/**
 * Mocked {@link FacilitatorService} implementation.
 */
@Slf4j
@Service
@Profile("mockedFacilitator")
@RequiredArgsConstructor
@SuppressWarnings({"checkstyle:DesignForExtension", "unused"})
public class MockedFacilitatorServiceImplementation implements FacilitatorService {

    /** X402 parameters. */
    private final X402Parameters x402Parameters;

    @Override
    public Mono<SupportedResponse> supported() {
        return Mono.just(SupportedResponse.builder()
                .kind(SupportedResponse.SupportedKind.builder()
                        .x402Version(X402_SUPPORTED_VERSION_BY_MOGAMI.version())
                        .scheme(EXACT_SCHEME.name())
                        .network(BASE_SEPOLIA.networkId())
                        .build())
                .kind(SupportedResponse.SupportedKind.builder()
                        .x402Version(X402_SUPPORTED_VERSION_BY_MOGAMI.version())
                        .scheme(EXACT_SCHEME.name())
                        .network(BASE_MAINNET.networkId())
                        .build())
                .signer("eip155:*", List.of(x402Parameters.defaultNetwork()))
                .build());
    }

    @Override
    public Mono<VerificationResponse> verify(final PaymentPayload paymentPayload,
                                             final PaymentRequirements paymentRequirements) {
        final String fromAddress = paymentPayload.getFromAddress().orElseThrow(
                () -> new IllegalStateException("fromAddress should be present in the payment payload")
        );

        // Default error.
        VerificationResponse verificationResponse = VerificationResponse.builder()
                .isValid(false)
                .invalidReason(UNKNOWN.getCode())
                .payer(fromAddress)
                .build();
        // Wallet with insufficient funds simulation.
        if (fromAddress.equalsIgnoreCase(EMPTY_WALLET_ADDRESS)) {
            verificationResponse = VerificationResponse.builder()
                    .isValid(false)
                    .invalidReason(INSUFFICIENT_FUNDS.getCode())
                    .payer(fromAddress)
                    .build();
        }
        // Normal address.
        if (fromAddress.equalsIgnoreCase(TEST_CLIENT_WALLET_ADDRESS_1)) {
            verificationResponse = VerificationResponse.builder()
                    .isValid(true)
                    .payer(fromAddress)
                    .build();
        }
        return Mono.just(verificationResponse);
    }

    @Override
    public Mono<SettlementResponse> settle(final PaymentPayload paymentPayload,
                                           final PaymentRequirements paymentRequirements) {
        final String fromAddress = paymentPayload.getFromAddress().orElseThrow(
                () -> new IllegalStateException("fromAddress should be present in the payment payload")
        );

        // Default error.
        SettlementResponse settlementResponse = SettlementResponse.builder()
                .success(false)
                .errorReason(UNKNOWN.getCode())
                .payer(fromAddress)
                .network(BASE_SEPOLIA.networkId())
                .build();
        // Wallet with insufficient funds simulation.
        if (fromAddress.equalsIgnoreCase(EMPTY_WALLET_ADDRESS)) {
            settlementResponse = SettlementResponse.builder()
                    .success(false)
                    .errorReason(INSUFFICIENT_FUNDS.getCode())
                    .payer(fromAddress)
                    .network(BASE_SEPOLIA.networkId())
                    .build();
        }
        // Normal address.
        if (fromAddress.equalsIgnoreCase(TEST_CLIENT_WALLET_ADDRESS_1)) {
            settlementResponse = SettlementResponse.builder()
                    .success(true)
                    .payer(fromAddress)
                    .transaction("0xMockedTransactionHash1234567890abcdef")
                    .network(BASE_SEPOLIA.networkId())
                    .build();
        }
        return Mono.just(settlementResponse);
    }

}
