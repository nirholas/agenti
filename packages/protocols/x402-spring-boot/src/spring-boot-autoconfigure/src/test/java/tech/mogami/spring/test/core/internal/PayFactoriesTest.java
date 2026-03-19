package tech.mogami.spring.test.core.internal;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.mock.web.MockHttpServletRequest;
import tech.mogami.spring.annotation.X402PayUSDC;
import tech.mogami.spring.annotation.X402PaymentRequirements;
import tech.mogami.spring.app.basic.WeatherController;
import tech.mogami.spring.factory.annotation.PayFactories;
import tech.mogami.spring.parameter.X402Parameters;

import java.math.BigInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static tech.mogami.commons.constant.network.Networks.BASE_MAINNET;
import static tech.mogami.commons.constant.network.contract.BaseContracts.BASE_MAINNET_USDC_CONTRACT;
import static tech.mogami.commons.constant.network.contract.BaseContracts.BASE_SEPOLIA_USDC_CONTRACT;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_NAME;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_NAME;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_VERSION;
import static tech.mogami.commons.test.BaseMogamiTestData.TEST_SERVER_WALLET_ADDRESS_1;

@SuppressWarnings("EmptyMethod")
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Pay factories tests")
public class PayFactoriesTest {

    @Autowired
    X402Parameters x402Parameters;

    @Autowired
    PayFactories payFactories;

    @X402PayUSDC(amount = "3.5")
    void simpleX402PayUSDC() {
    }

    @X402PayUSDC(
            amount = "5.1",
            payTo = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            network = "eip155:8453"
    )
    void complexeX402PayUSDC() {
    }

    @Test
    @DisplayName("X402PayUSDCFactory")
    void testX402PayUSDCFactory() throws NoSuchMethodException {
        // simpleX402PayUSDC
        assertThat(payFactories.buildRequirements(
                getClass().getDeclaredMethod("simpleX402PayUSDC").getAnnotation(X402PayUSDC.class),
                getRequest()))
                .isNotNull()
                .satisfies(requirements -> {
                    assertThat(requirements.scheme()).isEqualTo(EXACT_SCHEME_NAME);
                    assertThat(requirements.network()).isEqualTo(x402Parameters.defaultNetwork());
                    assertThat(requirements.amountAsBigInteger().compareTo(new BigInteger("3500000"))).isEqualTo(0);
                    assertThat(requirements.asset()).isEqualTo(BASE_SEPOLIA_USDC_CONTRACT);
                    assertThat(requirements.payTo()).isEqualTo(x402Parameters.defaultPayTo());
                    assertThat(requirements.maxTimeoutSeconds()).isEqualTo(60);
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_NAME)).isPresent();
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_NAME)).get().isEqualTo("USDC");
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).isPresent();
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).get().isEqualTo("2");
                });

        // complexeX402PayUSDC
        assertThat(payFactories.buildRequirements(
                getClass().getDeclaredMethod("complexeX402PayUSDC").getAnnotation(X402PayUSDC.class),
                getRequest()))
                .isNotNull()
                .satisfies(requirements -> {
                    assertThat(requirements.scheme()).isEqualTo(EXACT_SCHEME_NAME);
                    assertThat(requirements.network()).isEqualTo(BASE_MAINNET.networkId());
                    assertThat(requirements.amountAsBigInteger().compareTo(new BigInteger("5100000"))).isEqualTo(0);
                    assertThat(requirements.asset()).isEqualTo(BASE_MAINNET_USDC_CONTRACT);
                    assertThat(requirements.payTo()).isEqualTo("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
                    assertThat(requirements.maxTimeoutSeconds()).isEqualTo(60);
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_NAME)).isPresent();
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_NAME)).get().isEqualTo("USD Coin");
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).isPresent();
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).get().isEqualTo("2");
                });

    }

    @Test
    @DisplayName("X402PaymentRequirementsFactory")
    void X402PaymentRequirementsFactory() throws NoSuchMethodException {
        var annotations = AnnotatedElementUtils.findMergedRepeatableAnnotations(
                WeatherController.class.getDeclaredMethod("weather"),
                X402PaymentRequirements.class);
        var firstAnnotation = annotations.stream().findFirst();
        assertTrue(firstAnnotation.isPresent());

        assertThat(payFactories.buildRequirements(
                firstAnnotation.get(),
                getRequest()))
                .isNotNull()
                .satisfies(requirements -> {
                    assertThat(requirements.scheme()).isEqualTo(EXACT_SCHEME_NAME);
                    assertThat(requirements.network()).isEqualTo(x402Parameters.defaultNetwork());
                    assertThat(requirements.amountAsBigInteger().compareTo(new BigInteger("1000"))).isEqualTo(0);
                    assertThat(requirements.asset()).isEqualTo(BASE_SEPOLIA_USDC_CONTRACT);
                    assertThat(requirements.payTo()).isEqualTo(TEST_SERVER_WALLET_ADDRESS_1);
                    assertThat(requirements.maxTimeoutSeconds()).isEqualTo(60);
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_NAME)).isPresent();
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_NAME)).get().isEqualTo("USDC");
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).isPresent();
                    assertThat(requirements.getExtra(EXACT_SCHEME_PARAMETER_VERSION)).get().isEqualTo("2");
                });

    }

    private HttpServletRequest getRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/x402/pay");
        request.setServerName("localhost");
        request.setScheme("http");
        request.setServerPort(8080);
        return request; // returns http://localhost:8080/x402/pay
    }

}
