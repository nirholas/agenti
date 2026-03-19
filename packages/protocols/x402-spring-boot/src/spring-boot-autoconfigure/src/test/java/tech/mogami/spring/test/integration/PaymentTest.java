package tech.mogami.spring.test.integration;

import okhttp3.Headers;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.web3j.crypto.Credentials;
import tech.mogami.commons.payment.PaymentRequired;
import tech.mogami.java.client.X402V2Client;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static jakarta.servlet.http.HttpServletResponse.SC_PAYMENT_REQUIRED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Fail.fail;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static tech.mogami.commons.constant.network.Networks.BASE_SEPOLIA;
import static tech.mogami.commons.constant.network.contract.BaseContracts.BASE_SEPOLIA_USDC_CONTRACT;
import static tech.mogami.commons.constant.version.X402Versions.X402_SUPPORTED_VERSION_BY_MOGAMI;
import static tech.mogami.commons.payment.schemes.Schemes.EXACT_SCHEME;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_NAME;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_VERSION;
import static tech.mogami.commons.test.BaseMogamiTestData.TEST_CLIENT_WALLET_ADDRESS_1_PRIVATE_KEY;

@AutoConfigureMockMvc
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "x402.facilitator.base-url=https://x402.org/facilitator"
)
@DisplayName("Payment integration tests")
public class PaymentTest {

    @LocalServerPort
    int port;

    static Stream<String> protectedUrls() {
        return Stream.of(
                "https://www.x402.org/protected",
                "http://localhost:port/protected"
        );
    }

    /** OkHttpClient instance for making HTTP requests */
    private static final OkHttpClient CLIENT = new OkHttpClient();

    @MethodSource("protectedUrls")
    @ParameterizedTest(name = "Paywall enforced on {0}")
    @DisplayName("Paywall on https://www.x402.org/protected and localhost")
    void paywall(final String url) {
        final String finalUrl = url.replace("port", Integer.toString(port));
        Optional<PaymentRequired> paymentRequired = Optional.empty();

        // Calling protected url without payment =======================================================================
        try (Response initialResponse = CLIENT.newCall(new Request.Builder().url(finalUrl).get().build()).execute()) {

            if (initialResponse.code() != SC_PAYMENT_REQUIRED) {
                fail("Expected HTTP 402 Payment Required from " + url + ", but got " + initialResponse.code());
            }

            // Extracting the payments requirements from the header ================================================
            paymentRequired = X402V2Client.extractPaymentRequired(getHeaders(initialResponse));
            assertThat(paymentRequired).isNotEmpty().get()
                    .satisfies(p -> {
                        assertThat(p.getVersion()).isPresent();
                        assertThat(p.getVersion().get()).isEqualTo(X402_SUPPORTED_VERSION_BY_MOGAMI);
                        assertThat(p.error()).isEqualTo("Payment required");
                        assertThat(p.resource())
                                .satisfies(paymentResource -> {
                                    assertThat(paymentResource.url()).contains("https://www.x402.org/protected");
                                    assertThat(paymentResource.description()).contains("Access to protected content");
                                    assertThat(paymentResource.mimeType()).isBlank();
                                });
                        assertThat(p.accepts())
                                .hasSize(2)
                                .satisfies(accepts -> {
                                    assertThat(accepts.getFirst())
                                            .satisfies(accept -> {
                                                assertThat(accept.scheme()).isEqualTo(EXACT_SCHEME.name());
                                                assertThat(accept.network()).isEqualTo(BASE_SEPOLIA.networkId());
                                                assertThat(accept.amount()).isEqualTo("10000");
                                                assertThat(accept.asset()).isEqualTo(BASE_SEPOLIA_USDC_CONTRACT);
                                                assertThat(accept.payTo()).isEqualTo("0x209693Bc6afc0C5328bA36FaF03C514EF312287C");
                                                assertThat(accept.maxTimeoutSeconds()).isEqualTo(300);
                                                assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_NAME))
                                                        .isPresent()
                                                        .get()
                                                        .isEqualTo("USDC");
                                                assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_VERSION))
                                                        .isPresent()
                                                        .get()
                                                        .isEqualTo("2");
                                            });
                                    assertThat(accepts.getLast())
                                            .satisfies(accept -> {
                                                assertThat(accept.scheme()).isEqualTo(EXACT_SCHEME.name());
                                                assertThat(accept.network()).isEqualTo("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
                                                assertThat(accept.amount()).isEqualTo("10000");
                                                assertThat(accept.asset()).isEqualTo("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
                                                assertThat(accept.payTo()).isEqualTo("CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5");
                                                assertThat(accept.maxTimeoutSeconds()).isEqualTo(300);
                                                assertThat(accept.getExtra("feePayer"))
                                                        .isPresent()
                                                        .get()
                                                        .isEqualTo("CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5");
                                            });
                                });
                    });


        } catch (IOException e) {
            fail("IOException during HTTP request to " + url + ": " + e.getMessage());
        }

        // Calling protected url with a fake payment requirement =======================================================
        // TODO Reference implementation doesn't reply with settlement response when the fake payment is made.
//        PaymentRequirements fakeRequirements = PaymentRequirements.builder()
//                .scheme(EXACT_SCHEME.name())
//                .network(BASE_SEPOLIA.networkId())
//                .amount("10")
//                .asset(BASE_SEPOLIA_USDC_CONTRACT)
//                .payTo("0x209693Bc6afc0C5328bA36FaF03C514EF312287C")
//                .maxTimeoutSeconds(300)
//                .extra(EXACT_SCHEME_PARAMETER_NAME, "USDC")
//                .extra(EXACT_SCHEME_PARAMETER_VERSION, "2")
//                .build();
//        Map<String, String> paymentHeaders = X402V2Client.buildPaymentHeaders(
//                X402V2Client.signPaymentPayload(
//                        fakeRequirements,
//                        X402V2Client.createPaymentPayload(fakeRequirements, TEST_CLIENT_WALLET_ADDRESS_1),
//                        Credentials.create(TEST_CLIENT_WALLET_ADDRESS_1_PRIVATE_KEY))
//        );
//
//        try (Response fakePaymentResponse = CLIENT.newCall(new Request.Builder()
//                .url(url)
//                .get()
//                .addHeader(
//                        X402_PAYMENT_SIGNATURE_HEADER,
//                        paymentHeaders.get(X402_PAYMENT_SIGNATURE_HEADER)
//                )
//                .build()).execute()) {
//
//            System.out.println("Server response: " + fakePaymentResponse);
//            System.out.println("Server response: " + fakePaymentResponse.code());
//
//            fetchSettlementResponse(getHeaders(fakePaymentResponse)).ifPresentOrElse(
//                    settlementResponse -> System.out.println("✅ Settlement response received: " + settlementResponse.errorReason()),
//                    () -> fail("No settlement response found in the paid request headers.")
//            );
//
//        } catch (IOException e) {
//            fail("IOException during HTTP request to " + url + " with payment: " + e.getMessage());
//        }

        // We make a payment without balance ===========================================================================
        assertTrue(paymentRequired.isPresent());
        var payloadWithEmptyBalance = X402V2Client.buildPaymentPayload(
                paymentRequired.get(),
                paymentRequired.get().accepts().getFirst(),
                Credentials.create("0x1d353b7fbc67f67108c7690b572a6fd979325ce3cc3d18c82643cc9af41b2506"));

        try (Response noSignaturePaymentResponse = CLIENT.newCall(new Request.Builder()
                .url(finalUrl)
                .get()
                .headers(Headers.of(X402V2Client.buildPaymentHeaders(payloadWithEmptyBalance)))
                .build()).execute()) {

            // Checking the response header.
            // TODO Fix this
//            X402V2Client.fetchSettlementResponse(getHeaders(noSignaturePaymentResponse)).ifPresentOrElse(
//                    settlementResponse -> {
//                        System.out.println("✅ Settlement response received: " + settlementResponse);
//                        assertThat(settlementResponse.success()).isFalse();
//                        assertThat(settlementResponse.errorReason()).isEqualTo(INVALID_EXACT_EVM_PAYLOAD_SIGNATURE.getCode());
//                        assertThat(settlementResponse.payer()).isEqualTo(TEST_CLIENT_WALLET_ADDRESS_1);
//                        assertThat(settlementResponse.transaction()).isBlank();
//                        assertThat(settlementResponse.network()).isEqualTo(BASE_SEPOLIA.networkId());
//                    },
//                    () -> fail("No settlement response found in the paid request headers.")
//            );

            // Checking the response body.
            System.out.println("Server response: " + noSignaturePaymentResponse);
            assertThat(noSignaturePaymentResponse).isNotNull();
            assertThat(noSignaturePaymentResponse.isSuccessful()).isFalse();

        } catch (IOException e) {
            fail("IOException during HTTP request to " + url + " with payment: " + e.getMessage());
        }

        // We make a real payment ======================================================================================
        var validPayload = X402V2Client.buildPaymentPayload(
                paymentRequired.get(),
                paymentRequired.get().accepts().getFirst(),
                Credentials.create(TEST_CLIENT_WALLET_ADDRESS_1_PRIVATE_KEY)
        );
        try (Response paidResponse = CLIENT.newCall(new Request.Builder()
                .url(finalUrl)
                .get()
                .headers(Headers.of(X402V2Client.buildPaymentHeaders(validPayload)))
                .build()).execute()) {

            // Checking the response header.
            // TODO Fix this
//            X402V2Client.fetchSettlementResponse(getHeaders(paidResponse)).ifPresentOrElse(
//                    settlementResponse -> {
//                        System.out.println("✅ Settlement response received: " + settlementResponse);
//                        assertThat(settlementResponse.success()).isTrue();
//                        assertThat(settlementResponse.errorReason()).isBlank();
//                        assertThat(settlementResponse.payer()).isEqualTo(TEST_CLIENT_WALLET_ADDRESS_1);
//                        assertThat(settlementResponse.transaction()).isNotBlank();
//                        assertThat(settlementResponse.network()).isEqualTo(BASE_SEPOLIA.networkId());
//                    },
//                    () -> fail("No settlement response found in the paid request headers.")
//            );

            // Checking the response body.
            System.out.println("Server response: " + paidResponse);
            assertThat(paidResponse).isNotNull();
            assertThat(paidResponse.isSuccessful()).isTrue();
            assertThat(paidResponse.body()).isNotNull();
            assertThat(paidResponse.body().string()).contains("Your payment was successful!");
            System.out.println("✅ Payment accepted");
        } catch (IOException e) {
            fail("IOException during HTTP request to " + url + ": " + e.getMessage());
        }
    }

    private Map<String, String> getHeaders(Response response) {
        return response.headers().toMultimap()
                .entrySet().stream()
                .filter(e -> !e.getValue().isEmpty())
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().getFirst()));
    }

}
