package tech.mogami.spring.test.core.controllers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tech.mogami.java.client.X402V2Client;
import tech.mogami.spring.test.util.BaseTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Amount provider tests")
public class AmountProviderControllerTest extends BaseTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    @DisplayName("X402PaymentRequirements with basic amount provider")
    void dynamicAmountWithX402PaymentRequirements() throws Exception {
        // No type parameter.
        MvcResult result = mockMvc.perform(get("/dynamicAmountWithX402PaymentRequirements"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("3001")));

        // With type parameter.
        result = mockMvc.perform(get("/dynamicAmountWithX402PaymentRequirements").param("type", "image"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("1001")));
    }

    @Test
    @DisplayName("X402PaymentRequirements with spring amount provider")
    void dynamicAmountWithX402PaymentRequirementsWithSpring() throws Exception {
        // No type parameter.
        MvcResult result = mockMvc.perform(get("/dynamicAmountWithX402PaymentRequirementsWithSpring"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("6002")));

        // With type parameter.
        result = mockMvc.perform(get("/dynamicAmountWithX402PaymentRequirementsWithSpring").param("type", "text"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("5002")));
    }

    @Test
    @DisplayName("X402PayUSDC with basic amount provider")
    void dynamicAmountWithX402PayUSDC() throws Exception {
        // No type parameter.
        MvcResult result = mockMvc.perform(get("/dynamicAmountWithX402PayUSDC"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("3001")));

        // With type parameter.
        result = mockMvc.perform(get("/dynamicAmountWithX402PayUSDC").param("type", "text"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("2001")));
    }

    @Test
    @DisplayName("X402PayUSDC with spring amount provider")
    void dynamicAmountWithX402PayUSDCWithSpring() throws Exception {
        // No type parameter.
        MvcResult result = mockMvc.perform(get("/dynamicAmountWithX402PayUSDCWithSpring"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("6002")));

        // With type parameter.
        result = mockMvc.perform(get("/dynamicAmountWithX402PayUSDCWithSpring").param("type", "image"))
                .andExpect(status().isPaymentRequired())
                .andReturn();

        assertThat(X402V2Client.extractPaymentRequired(getHeaders(result.getResponse())))
                .isPresent().get()
                .satisfies(paymentRequired -> assertThat(paymentRequired.accepts().getFirst())
                        .isNotNull()
                        .satisfies(paymentRequirement -> assertThat(paymentRequirement.amount()).isEqualTo("4002")));
    }


}
