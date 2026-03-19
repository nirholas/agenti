package tech.mogami.spring.test.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.web3j.crypto.Credentials;
import tech.mogami.commons.api.facilitator.supported.SupportedResponse;
import tech.mogami.java.client.X402V2Client;
import tech.mogami.spring.provider.facilitator.FacilitatorService;
import tech.mogami.spring.test.util.BaseTest;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.AssertionsForClassTypes.tuple;
import static tech.mogami.commons.constant.X402Constants.X402_PAYMENT_REQUIRED_HEADER;
import static tech.mogami.commons.constant.X402Error.INSUFFICIENT_FUNDS;
import static tech.mogami.commons.constant.network.Networks.BASE_SEPOLIA;

@SpringBootTest(properties = "x402.facilitator.base-url=https://x402.org/facilitator")
@AutoConfigureMockMvc
@DisplayName("Facilitator client tests")
public class FacilitatorServiceTest extends BaseTest {

    @Autowired
    private FacilitatorService facilitatorService;

    @Test
    @DisplayName("/supported response")
    void supportedResponse() {
        assertThat(facilitatorService.supported().block())
                .isNotNull()
                .satisfies(supportedResponse -> {
                    // Supported kinds.
                    assertThat(supportedResponse.kinds())
                            .extracting(
                                    SupportedResponse.SupportedKind::x402Version,
                                    SupportedResponse.SupportedKind::scheme,
                                    SupportedResponse.SupportedKind::network
                            )
                            .containsExactly(
                                    tuple(2, "exact", "eip155:84532"),
                                    tuple(2, "exact", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),
                                    tuple(1, "exact", "base-sepolia"),
                                    tuple(1, "exact", "solana-devnet")
                            );
                    // Supported extensions.
                    assertThat(supportedResponse.kinds())
                            .filteredOn(kind -> kind.network().startsWith("solana"))
                            .allSatisfy(kind -> assertThat(kind.extra()).isNotNull().containsKey("feePayer"));
                    // Supported signers.
                    assertThat(supportedResponse.signers().get("eip155:*"))
                            .containsExactly("0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf");
                    assertThat(supportedResponse.signers().get("solana:*"))
                            .containsExactly("CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5");
                });
    }

    @Test
    @DisplayName("/verify response")
    void verifyResponse() {
        var PaymentRequired = X402V2Client.extractPaymentRequired(
                Map.of(X402_PAYMENT_REQUIRED_HEADER, getX402ProtectedPaymentRequiredHeader())
        ).orElseThrow(() -> new IllegalStateException("PaymentRequired should be present"));

        // Payment with an empty balance ===============================================================================
        var emptyBalancePaymentPayload = X402V2Client.buildPaymentPayload(
                PaymentRequired,
                PaymentRequired.accepts().getFirst(),
                Credentials.create(EMPTY_WALLET_ADDRESS_PRIVATE_KEY)
        );
        assertThat(facilitatorService.verify(emptyBalancePaymentPayload, emptyBalancePaymentPayload.accepted()).block())
                .isNotNull()
                .satisfies(verifyResponse -> {
                    assertThat(verifyResponse.isValid()).isFalse();
                    assertThat(verifyResponse.invalidReason()).isEqualTo(INSUFFICIENT_FUNDS.getCode());
                    assertThat(verifyResponse.payer()).isEqualToIgnoringCase(EMPTY_WALLET_ADDRESS);
                });

        // Valid payment payload =======================================================================================
        var paymentPayload = X402V2Client.buildPaymentPayload(
                PaymentRequired,
                PaymentRequired.accepts().getFirst(),
                Credentials.create(TEST_CLIENT_WALLET_ADDRESS_1_PRIVATE_KEY)
        );
        assertThat(facilitatorService.verify(paymentPayload, paymentPayload.accepted()).block())
                .isNotNull()
                .satisfies(verifyResponse -> {
                    assertThat(verifyResponse.isValid()).isTrue();
                    assertThat(verifyResponse.invalidReason()).isBlank();
                    assertThat(verifyResponse.payer()).isEqualToIgnoringCase(TEST_CLIENT_WALLET_ADDRESS_1);
                });
    }

    @Test
    @DisplayName("/settle response")
    void settleResponse() {
        var PaymentRequired = X402V2Client.extractPaymentRequired(
                Map.of(X402_PAYMENT_REQUIRED_HEADER, getX402ProtectedPaymentRequiredHeader())
        ).orElseThrow(() -> new IllegalStateException("PaymentRequired should be present"));

        // Payment with an empty balance ===============================================================================
        var emptyBalancePaymentPayload = X402V2Client.buildPaymentPayload(
                PaymentRequired,
                PaymentRequired.accepts().getFirst(),
                Credentials.create(EMPTY_WALLET_ADDRESS_PRIVATE_KEY)
        );
        assertThat(facilitatorService.settle(emptyBalancePaymentPayload, emptyBalancePaymentPayload.accepted()).block())
                .isNotNull()
                .satisfies(settlementResponse -> {
                    assertThat(settlementResponse.success()).isFalse();
                    assertThat(settlementResponse.errorReason()).isEqualTo(INSUFFICIENT_FUNDS.getCode());
                    assertThat(settlementResponse.payer()).isEqualToIgnoringCase(EMPTY_WALLET_ADDRESS);
                    assertThat(settlementResponse.transaction()).isEmpty();
                    assertThat(settlementResponse.network()).isEqualTo(BASE_SEPOLIA.networkId());
                });
    }

}
