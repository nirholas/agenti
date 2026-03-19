package tech.mogami.spring.factory.annotation;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import tech.mogami.commons.constant.network.Network;
import tech.mogami.commons.payment.PaymentRequirements;
import tech.mogami.spring.annotation.X402PayUSDC;

import java.util.Map;

import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_NAME;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_PARAMETER_VERSION;

/**
 * X402 Pay USDC Factory.
 */
@Slf4j
public class X402PayUSDCFactory extends AbstractPayFactory<X402PayUSDC> {

    @Override
    public final PaymentRequirements buildRequirements(final X402PayUSDC annotation, final HttpServletRequest request) {
        // Choosing the network.
        final Network network = getNetworkByNetworkId(StringUtils.firstNonBlank(annotation.network(), x402Parameters.defaultNetwork()));

        return PaymentRequirements.builder()
                .scheme(annotation.scheme())
                .network(network.networkId())
                .amount(
                        amountResolver.resolveAmountInAtomicUnit(
                                network.usdc().toAtomic(annotation.amount()).toPlainString(),
                                annotation.amountProvider(),
                                request)
                )
                .asset(network.usdc().contractAddress())
                .payTo(StringUtils.firstNonBlank(annotation.payTo(), x402Parameters.defaultPayTo()))
                .maxTimeoutSeconds(annotation.maximumTimeoutSeconds())
                .extra(Map.of(EXACT_SCHEME_PARAMETER_NAME, network.usdc().displayName()))
                .extra(Map.of(EXACT_SCHEME_PARAMETER_VERSION, "2"))
                .build();
    }

}
