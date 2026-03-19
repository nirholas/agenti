package tech.mogami.spring.factory.annotation;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import tech.mogami.commons.constant.network.Network;
import tech.mogami.commons.payment.PaymentRequirements;
import tech.mogami.spring.annotation.X402PaymentRequirements;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * X402 Payment Requirements Factory.
 */
@Slf4j
public class X402PaymentRequirementsFactory extends AbstractPayFactory<X402PaymentRequirements> {

    @Override
    public final PaymentRequirements buildRequirements(final X402PaymentRequirements annotation, final HttpServletRequest request) {
        final Network network = getNetworkByNetworkId(annotation.network());

        return PaymentRequirements.builder()
                .scheme(annotation.scheme())
                .network(network.networkId())
                .amount(
                        amountResolver.resolveAmountInAtomicUnit(
                                annotation.amount(),
                                annotation.amountProvider(),
                                request)
                )
                .asset(annotation.asset())
                .payTo(StringUtils.firstNonBlank(annotation.payTo(), x402Parameters.defaultPayTo()))
                .maxTimeoutSeconds(annotation.maximumTimeoutSeconds())
                .extra(Arrays.stream(annotation.extra())
                        .collect(Collectors.toMap(
                                X402PaymentRequirements.ExtraEntry::key,
                                X402PaymentRequirements.ExtraEntry::value)))
                .build();
    }
}
