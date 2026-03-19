package tech.mogami.spring.test.core.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.web3j.crypto.Credentials;
import reactor.core.publisher.Mono;
import tech.mogami.commons.api.facilitator.settle.SettlementResponse;
import tech.mogami.commons.api.facilitator.verify.VerificationResponse;
import tech.mogami.java.client.X402V2Client;
import tech.mogami.spring.provider.facilitator.FacilitatorService;
import tech.mogami.spring.test.util.BaseTest;

import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static tech.mogami.commons.constant.X402Constants.X402_PAYMENT_SIGNATURE_HEADER;
import static tech.mogami.commons.constant.network.Networks.BASE_SEPOLIA;

@SpringBootTest
@ActiveProfiles("mockedFacilitator")
@AutoConfigureMockMvc
@DisplayName("Concurrent payment nonce protection tests")
public class ConcurrentNonceControllerTest extends BaseTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    FacilitatorService facilitatorService;

    @Test
    @DisplayName("Concurrent requests reusing the same payment nonce are rejected (TOCTOU protection)")
    void concurrentRequestsWithSameNonceAreRejected() throws Exception {
        // Latches to control the timing of the first request's verify call
        CountDownLatch verifyStarted = new CountDownLatch(1);
        CountDownLatch releaseVerify = new CountDownLatch(1);

        // Mock verify: blocks until released, simulating the verify–settle gap
        when(facilitatorService.verify(any(), any())).thenAnswer(invocation -> {
            verifyStarted.countDown();
            assertTrue(releaseVerify.await(5, SECONDS), "releaseVerify latch timed out");
            return Mono.just(VerificationResponse.builder()
                    .isValid(true)
                    .payer(TEST_CLIENT_WALLET_ADDRESS_1)
                    .build());
        });
        when(facilitatorService.settle(any(), any())).thenReturn(Mono.just(SettlementResponse.builder()
                .success(true)
                .payer(TEST_CLIENT_WALLET_ADDRESS_1)
                .network(BASE_SEPOLIA.networkId())
                .transaction("0xMockedTransactionHash")
                .build()));

        // Obtain payment requirements to build a valid payment payload
        MvcResult challengeResult = mockMvc.perform(get("/weather"))
                .andExpect(status().isPaymentRequired())
                .andReturn();
        var paymentRequired = X402V2Client.extractPaymentRequired(getHeaders(challengeResult.getResponse()))
                .orElseThrow(() -> new IllegalStateException("PaymentRequired should be present"));

        var paymentPayload = X402V2Client.buildPaymentPayload(
                paymentRequired,
                paymentRequired.accepts().getFirst(),
                Credentials.create(TEST_CLIENT_WALLET_ADDRESS_1_PRIVATE_KEY)
        );
        Map<String, String> paymentHeaders = X402V2Client.buildPaymentHeaders(paymentPayload);
        HttpHeaders headers = new HttpHeaders();
        headers.add(X402_PAYMENT_SIGNATURE_HEADER, paymentHeaders.get(X402_PAYMENT_SIGNATURE_HEADER));

        // Send the first request in a background thread; it will be held inside verify()
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<MvcResult> future1 = executor.submit(() ->
                    mockMvc.perform(get("/weather").headers(headers)).andReturn()
            );

            // Wait until the first request has entered verify() and holds the nonce
            assertTrue(verifyStarted.await(5, SECONDS), "First request should reach verify");

            // Send a second request with the same payment header while the first is still in-flight
            MvcResult result2 = mockMvc.perform(get("/weather").headers(headers))
                    .andExpect(status().isPaymentRequired())
                    .andReturn();

            // The second request must be rejected because the nonce is already being processed
            assertThat(X402V2Client.extractPaymentRequired(getHeaders(result2.getResponse())))
                    .isPresent().get()
                    .satisfies(pr -> assertThat(pr.error()).isEqualTo("Payment is already being processed"));

            // Release the first request and verify it completes successfully
            releaseVerify.countDown();
            MvcResult result1 = future1.get(10, SECONDS);
            assertThat(result1.getResponse().getStatus()).isEqualTo(200);
        } finally {
            executor.shutdown();
        }
    }

}
