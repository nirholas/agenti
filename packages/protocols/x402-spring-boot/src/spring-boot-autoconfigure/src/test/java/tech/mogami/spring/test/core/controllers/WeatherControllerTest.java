package tech.mogami.spring.test.core.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.web3j.crypto.Credentials;
import tech.mogami.commons.payment.PaymentRequirements;
import tech.mogami.java.client.X402V2Client;
import tech.mogami.spring.parameter.X402Parameters;
import tech.mogami.spring.test.util.BaseTest;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static tech.mogami.commons.constant.X402Constants.X402_DEFAULT_PAYMENT_TIMEOUT_SECONDS;
import static tech.mogami.commons.constant.X402Constants.X402_PAYMENT_SIGNATURE_HEADER;
import static tech.mogami.commons.constant.X402Error.INSUFFICIENT_FUNDS;
import static tech.mogami.commons.constant.network.Networks.BASE_MAINNET;
import static tech.mogami.commons.constant.network.Networks.BASE_SEPOLIA;
import static tech.mogami.commons.constant.network.contract.BaseContracts.BASE_MAINNET_USDC_CONTRACT;
import static tech.mogami.commons.constant.network.contract.BaseContracts.BASE_SEPOLIA_USDC_CONTRACT;
import static tech.mogami.commons.constant.version.X402Versions.X402_SUPPORTED_VERSION_BY_MOGAMI;
import static tech.mogami.commons.payment.schemes.Schemes.EXACT_SCHEME;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_NAME;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_VERSION;

@SpringBootTest
@ActiveProfiles("mockedFacilitator")
@AutoConfigureMockMvc
@DisplayName("Weather controller tests")
public class WeatherControllerTest extends BaseTest {

    @Autowired
    X402Parameters x402Parameters;

    @Autowired
    MockMvc mockMvc;

    @Test
    @DisplayName("get /weather/without-payment")
    void getFreeWeather() throws Exception {
        mockMvc.perform(get("/weather/without-payment"))
                .andExpect(status().isOk())
                .andExpect(content().string("It's rainy!"));
    }

    @Test
    @DisplayName("get /weather without payment header")
    void getWeatherWithoutPaymentHeader() throws Exception {
        MvcResult result = mockMvc.perform(get("/weather"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> {
                    // Version =========================================================================================
                    assertThat(paymentRequired.x402Version()).isEqualTo(X402_SUPPORTED_VERSION_BY_MOGAMI.version());

                    // Error ===========================================================================================
                    assertThat(paymentRequired.error()).isEqualTo("Payment required");

                    // Resource =========================================================================================
                    assertThat(paymentRequired.resource())
                            .isNotNull()
                            .satisfies(resource -> {
                                assertThat(resource.url()).isEqualTo("http://localhost/weather");
                                assertThat(resource.description()).isNull();
                                assertThat(resource.mimeType()).isNull();
                            });

                    // Accepts ==========================================================================================
                    assertThat(paymentRequired.accepts())
                            .isNotNull()
                            .hasSize(2)
                            .satisfies(acceptsList -> {
                                // First accept ========================================================================
                                assertThat(acceptsList.getFirst())
                                        .isNotNull()
                                        .satisfies(accept -> {
                                            assertThat(accept.scheme()).isEqualTo(EXACT_SCHEME.name());
                                            assertThat(accept.network()).isEqualTo(BASE_SEPOLIA.networkId());
                                            assertThat(accept.amount()).isEqualTo("1000");
                                            assertThat(accept.asset()).isEqualTo(BASE_SEPOLIA_USDC_CONTRACT);
                                            assertThat(accept.payTo()).isEqualTo(TEST_SERVER_WALLET_ADDRESS_1);
                                            assertThat(accept.maxTimeoutSeconds()).isEqualTo(X402_DEFAULT_PAYMENT_TIMEOUT_SECONDS);
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_NAME)).isPresent().get()
                                                    .isEqualTo("USDC");
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).isPresent().get()
                                                    .isEqualTo("2");
                                        });
                                // Second accept =======================================================================
                                assertThat(acceptsList.getLast())
                                        .isNotNull()
                                        .satisfies(accept -> {
                                            assertThat(accept.scheme()).isEqualTo(EXACT_SCHEME.name());
                                            assertThat(accept.network()).isEqualTo(BASE_SEPOLIA.networkId());
                                            assertThat(accept.amount()).isEqualTo("2000");
                                            assertThat(accept.asset()).isEqualTo(BASE_SEPOLIA_USDC_CONTRACT);
                                            assertThat(accept.payTo()).isEqualTo(TEST_SERVER_WALLET_ADDRESS_2);
                                            assertThat(accept.maxTimeoutSeconds()).isEqualTo(10);
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_NAME)).isNotPresent();
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).isNotPresent();
                                        });
                            });
                });
    }

    @Test
    @DisplayName("get /weatherWithX402PayUSDC with without payment header")
    void getWeatherWithX402PayUSDCWithoutPaymentHeader() throws Exception {
        MvcResult result = mockMvc.perform(get("/weatherWithX402PayUSDC"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> {
                    // Version =========================================================================================
                    assertThat(paymentRequired.x402Version()).isEqualTo(X402_SUPPORTED_VERSION_BY_MOGAMI.version());

                    // Error ===========================================================================================
                    assertThat(paymentRequired.error()).isEqualTo("Payment required");

                    // Resource =========================================================================================
                    assertThat(paymentRequired.resource())
                            .isNotNull()
                            .satisfies(resource -> {
                                assertThat(resource.url()).isEqualTo("/weatherWithX402PayUSDC");
                                assertThat(resource.description()).isEqualTo("Access to weather data with X402PayUSDC");
                                assertThat(resource.mimeType()).isEqualTo("text/plain");
                            });

                    // Accepts =========================================================================================
                    assertThat(paymentRequired.accepts())
                            .isNotNull()
                            .hasSize(2)
                            .satisfies(acceptsList -> {
                                // First accept ========================================================================
                                assertThat(acceptsList.getFirst())
                                        .isNotNull()
                                        .satisfies(accept -> {
                                            assertThat(accept.scheme()).isEqualTo(EXACT_SCHEME.name());
                                            assertThat(accept.network()).isEqualTo(BASE_SEPOLIA.networkId());
                                            assertThat(accept.amount()).isEqualTo("3600000");
                                            assertThat(accept.asset()).isEqualTo(BASE_SEPOLIA_USDC_CONTRACT);
                                            assertThat(accept.payTo()).isEqualTo(x402Parameters.defaultPayTo());
                                            assertThat(accept.maxTimeoutSeconds()).isEqualTo(X402_DEFAULT_PAYMENT_TIMEOUT_SECONDS);
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_NAME)).isPresent().get()
                                                    .isEqualTo("USDC");
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).isPresent().get()
                                                    .isEqualTo("2");
                                        });
                                // Second accept =======================================================================
                                assertThat(acceptsList.getLast())
                                        .isNotNull()
                                        .satisfies(accept -> {
                                            assertThat(accept.scheme()).isEqualTo(EXACT_SCHEME.name());
                                            assertThat(accept.network()).isEqualTo(BASE_MAINNET.networkId());
                                            assertThat(accept.amount()).isEqualTo("5200000");
                                            assertThat(accept.asset()).isEqualTo(BASE_MAINNET_USDC_CONTRACT);
                                            assertThat(accept.payTo()).isEqualTo("0x71C7656EC7ab88b098defB751B7401B5f6d8976H");
                                            assertThat(accept.maxTimeoutSeconds()).isEqualTo(10);
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_NAME)).isPresent().get()
                                                    .isEqualTo("USD Coin");
                                            assertThat(accept.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).isPresent().get()
                                                    .isEqualTo("2");
                                        });
                            });
                });
    }

    @Test
    @DisplayName("get /weather with invalid payment header")
    void getWeatherWithInvalidPaymentHeader() throws Exception {
        // Getting the payment required to build a payment payload with an empty wallet address ========================
        var result = mockMvc.perform(get("/weather"))
                .andExpect(status().isPaymentRequired())
                .andReturn();
        var PaymentRequired = X402V2Client.extractPaymentRequired(getHeaders(result.getResponse()))
                .orElseThrow(() -> new IllegalStateException("PaymentRequired should be present"));

        // Sending a payment payload with an empty wallet address ======================================================
        var emptyBalancePaymentPayload = X402V2Client.buildPaymentPayload(
                PaymentRequired,
                PaymentRequired.accepts().getFirst(),
                Credentials.create(EMPTY_WALLET_ADDRESS_PRIVATE_KEY)
        );
        final Map<String, String> paymentHeaders = X402V2Client.buildPaymentHeaders(emptyBalancePaymentPayload);
        HttpHeaders headers = new HttpHeaders();
        headers.add(X402_PAYMENT_SIGNATURE_HEADER, paymentHeaders.get(X402_PAYMENT_SIGNATURE_HEADER));

        result = mockMvc.perform(get("/weather").headers(headers))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        // We should get a payment required response indicating insufficient funds =====================================
        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequiredResponse -> {
                    assertThat(paymentRequiredResponse.x402Version()).isEqualTo(X402_SUPPORTED_VERSION_BY_MOGAMI.version());
                    assertThat(paymentRequiredResponse.error()).isEqualTo(INSUFFICIENT_FUNDS.getCode());
                });
    }

    @Test
    @DisplayName("get /weatherWithX402PayUSDC with an unknow payment requirements")
    void getWeatherWithX402PayUSDCWithAnUnknowPaymentRequirements() throws Exception {
        // Getting the payment required to build a payment payload =====================================================
        var result = mockMvc.perform(get("/weatherWithX402PayUSDC"))
                .andExpect(status().isPaymentRequired())
                .andReturn();
        var PaymentRequired = X402V2Client.extractPaymentRequired(getHeaders(result.getResponse()))
                .orElseThrow(() -> new IllegalStateException("PaymentRequired should be present"));

        // We create a different payment requirements to generate a payment payload that will be considered invalid ====
        var anotherPaymentRequirements = PaymentRequirements.builder()
                .scheme(EXACT_SCHEME.name())
                .network(BASE_SEPOLIA.networkId())
                .amount("10000")
                .payTo(TEST_SERVER_WALLET_ADDRESS_1)
                .maxTimeoutSeconds(60)
                .asset("0x036CbD53842c5426634e7929541eC2318f3dCF7e")
                .extra(EXACT_SCHEME_PARAMETER_NAME, "USDC")
                .extra(EXACT_SCHEME_PARAMETER_VERSION, "2")
                .build();

        var paymentPayload = X402V2Client.buildPaymentPayload(
                PaymentRequired,
                anotherPaymentRequirements,
                Credentials.create(TEST_CLIENT_WALLET_ADDRESS_1_PRIVATE_KEY)
        );


        final Map<String, String> paymentHeaders = X402V2Client.buildPaymentHeaders(paymentPayload);
        HttpHeaders headers = new HttpHeaders();
        headers.add(X402_PAYMENT_SIGNATURE_HEADER, paymentHeaders.get(X402_PAYMENT_SIGNATURE_HEADER));

        // Calling the API with the payment header.
        result = mockMvc.perform(get("/weatherWithX402PayUSDC").headers(headers))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        // Checking the response =======================================================================================
        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequiredResponse -> {
                    assertThat(paymentRequiredResponse.x402Version()).isEqualTo(X402_SUPPORTED_VERSION_BY_MOGAMI.version());
                    assertThat(paymentRequiredResponse.error()).isEqualTo("PaymentRequirements from payment payload is not compatible with any of the required payment requirements");
                });
    }

    @Test
    @DisplayName("get /weather with valid payment header")
    void getWeatherWithValidPaymentHeader() throws Exception {
        // Getting the payment required to build a payment payload =====================================================
        var result = mockMvc.perform(get("/weather"))
                .andExpect(status().isPaymentRequired())
                .andReturn();
        var PaymentRequired = X402V2Client.extractPaymentRequired(getHeaders(result.getResponse()))
                .orElseThrow(() -> new IllegalStateException("PaymentRequired should be present"));

        // Building a valid payment payload ============================================================================
        var paymentPayload = X402V2Client.buildPaymentPayload(
                PaymentRequired,
                PaymentRequired.accepts().getFirst(),
                Credentials.create(TEST_CLIENT_WALLET_ADDRESS_1_PRIVATE_KEY)
        );
        final Map<String, String> paymentHeaders = X402V2Client.buildPaymentHeaders(paymentPayload);
        HttpHeaders headers = new HttpHeaders();
        headers.add(X402_PAYMENT_SIGNATURE_HEADER, paymentHeaders.get(X402_PAYMENT_SIGNATURE_HEADER));

        // Calling the API with the payment header.
        result = mockMvc.perform(get("/weather").headers(headers))
                .andExpect(status().isOk())
                .andExpect(content().string("It's sunny!"))
                .andReturn();

        // Checking the response =======================================================================================
        assertThat(X402V2Client.extractSettlementResponse(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(settlementResponse -> {
                    assertThat(settlementResponse.success()).isTrue();
                    assertThat(settlementResponse.errorReason()).isBlank();
                    assertThat(settlementResponse.payer()).isEqualToIgnoringCase(TEST_CLIENT_WALLET_ADDRESS_1);
                    assertThat(settlementResponse.network()).isEqualTo(BASE_SEPOLIA.networkId());
                });
    }

}
