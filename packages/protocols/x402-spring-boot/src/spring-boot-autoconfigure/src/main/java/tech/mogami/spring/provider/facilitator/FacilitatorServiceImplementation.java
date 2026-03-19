package tech.mogami.spring.provider.facilitator;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import tech.mogami.commons.api.facilitator.settle.SettlementRequest;
import tech.mogami.commons.api.facilitator.settle.SettlementResponse;
import tech.mogami.commons.api.facilitator.supported.SupportedResponse;
import tech.mogami.commons.api.facilitator.verify.VerificationRequest;
import tech.mogami.commons.api.facilitator.verify.VerificationResponse;
import tech.mogami.commons.payment.PaymentPayload;
import tech.mogami.commons.payment.PaymentRequirements;
import tech.mogami.commons.util.JsonUtil;
import tech.mogami.spring.parameter.X402Parameters;

import static org.springframework.http.HttpHeaders.ACCEPT;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;
import static tech.mogami.commons.api.facilitator.FacilitatorApiEndpoints.SETTLE_ENDPOINT;
import static tech.mogami.commons.api.facilitator.FacilitatorApiEndpoints.SUPPORTED_ENDPOINT;
import static tech.mogami.commons.api.facilitator.FacilitatorApiEndpoints.VERIFY_ENDPOINT;

/**
 * {@link FacilitatorService} implementation.
 */
@Slf4j
@Service
@Profile("!mockedFacilitator")
@RequiredArgsConstructor
@SuppressWarnings({"checkstyle:DesignForExtension", "unused"})
public class FacilitatorServiceImplementation implements FacilitatorService {

    /** X402 parameters. */
    private final X402Parameters x402Parameters;

    /** Web client. */
    private WebClient client;

    /**
     * Building web client.
     */
    @PostConstruct
    public void init() {
        this.client = WebClient.builder()
                .baseUrl(x402Parameters.facilitator().baseUrl())
                .clientConnector(new ReactorClientHttpConnector(HttpClient.create().followRedirect(true)))
                .build();
    }

    @Override
    public Mono<SupportedResponse> supported() {
        return client.get()
                .uri(SUPPORTED_ENDPOINT)
                .header(ACCEPT, APPLICATION_JSON_VALUE)
                .retrieve()
                .bodyToMono(SupportedResponse.class)
                .doOnError(WebClientResponseException.class, error ->
                        log.error("Facilitator /support error: '{}'", error.getResponseBodyAsString())
                );
    }

    @Override
    public Mono<VerificationResponse> verify(final PaymentPayload paymentPayload,
                                             final PaymentRequirements paymentRequirements) {
        VerificationRequest verifyRequest = VerificationRequest.builder()
                //.x402Version(paymentPayload.x402Version())
                .paymentPayload(paymentPayload)
                .paymentRequirements(paymentRequirements)
                .build();
        log.info("Facilitator /verify request: '{}'", JsonUtil.toJson(verifyRequest));

        final String nonce = paymentPayload.getNonce()
                .orElseThrow(() -> new IllegalArgumentException("Nonce is required in the payment payload"));

        return client.post()
                .uri(VERIFY_ENDPOINT)
                .contentType(APPLICATION_JSON)
                .bodyValue(verifyRequest)
                .retrieve()
                .bodyToMono(VerificationResponse.class)
                .doOnNext(response -> log.info("Facilitator /verify response: '{}'", JsonUtil.toJson(response)))
                .doOnError(WebClientResponseException.class, error -> log.error("Facilitator /verify error: '{}'", error.getResponseBodyAsString()));
    }

    @Override
    public Mono<SettlementResponse> settle(final PaymentPayload paymentPayload,
                                           final PaymentRequirements paymentRequirements) {
        SettlementRequest settleRequest = SettlementRequest.builder()
                .paymentPayload(paymentPayload)
                .paymentRequirements(paymentRequirements)
                .build();
        log.info("Facilitator /settle request: '{}'", JsonUtil.toJson(settleRequest));

        final String nonce = paymentPayload.getNonce()
                .orElseThrow(() -> new IllegalArgumentException("Nonce is required in the payment payload"));

        return client.post()
                .uri(SETTLE_ENDPOINT)
                .contentType(APPLICATION_JSON)
                .bodyValue(settleRequest)
                .retrieve()
                .bodyToMono(SettlementResponse.class)
                .doOnNext(response -> log.info("Facilitator /settle response: '{}'", JsonUtil.toJson(response)))
                .doOnError(WebClientResponseException.class, error ->
                        log.error("Facilitator /settle error: '{}'", error.getResponseBodyAsString()));
    }

}
