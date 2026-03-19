package tech.mogami.spring.factory.annotation;

import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jspecify.annotations.Nullable;
import tech.mogami.commons.constant.network.Network;
import tech.mogami.commons.constant.network.Networks;
import tech.mogami.spring.parameter.X402Parameters;
import tech.mogami.spring.pricing.AmountProviderResolver;

import java.lang.annotation.Annotation;

/**
 * Abstract implementation of PayFactory that provides a default behavior.
 *
 * @param <A> the annotation type handled by this factory
 */
@Slf4j
public abstract class AbstractPayFactory<A extends Annotation> implements PayFactory<A> {

    /** X402 parameters. */
    @Setter
    protected X402Parameters x402Parameters;

    /** Amount provider resolver. */
    @Setter
    protected AmountProviderResolver amountResolver;

    /**
     * Gets the network by it's blockchain network identifier in CAIP-2 format (e.g., "eip155:84532").
     *
     * @param networkId Blockchain network identifier in CAIP-2 format (e.g., "eip155:84532")
     * @return the network
     * @throws IllegalArgumentException if the network is unsupported
     */
    protected Network getNetworkByNetworkId(@Nullable final String networkId) {
        return Networks.findByNetworkId(StringUtils.firstNonBlank(networkId, x402Parameters.defaultNetwork()))
                .orElseThrow(() -> new IllegalArgumentException("Unknown network: " + networkId));
    }

}
