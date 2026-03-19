package tech.mogami.spring.factory.annotation;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tech.mogami.commons.payment.PaymentRequirements;
import tech.mogami.spring.annotation.X402PayUSDC;
import tech.mogami.spring.annotation.X402PaymentRequirements;
import tech.mogami.spring.parameter.X402Parameters;
import tech.mogami.spring.pricing.AmountProviderResolver;

import java.lang.annotation.Annotation;
import java.util.HashMap;
import java.util.Map;

/**
 * PayFactories component - Contains all factories to transform annotation to payment requirements.
 */
@Component
@RequiredArgsConstructor
public class PayFactories {

    /** x402 parameters. */
    private final X402Parameters x402Parameters;

    /** Amount provider resolver. */
    private final AmountProviderResolver amountResolver;

    /** Registry of PayFactory instances mapped by their corresponding annotation classes. */
    private static final Map<Class<? extends Annotation>, PayFactory<?>> REGISTRY = new HashMap<>();

    @PostConstruct
    private void initializeFactories() {
        REGISTRY.put(X402PaymentRequirements.class, new X402PaymentRequirementsFactory());
        REGISTRY.put(X402PayUSDC.class, new X402PayUSDCFactory());

        // Initialize X402 parameters or other dependencies here.
        REGISTRY.values()
                .stream()
                .filter(factory -> factory instanceof AbstractPayFactory<?>)
                .map(AbstractPayFactory.class::cast)
                .forEach(factory -> {
                    factory.setX402Parameters(x402Parameters);
                    factory.setAmountResolver(amountResolver);
                });
    }

    /**
     * Build payment requirements from annotation and request.
     *
     * @param a       the annotation
     * @param request the HTTP servlet request
     * @return the payment requirements
     */
    public PaymentRequirements buildRequirements(final Annotation a, final HttpServletRequest request) {
        if (a.annotationType().equals(X402PayUSDC.class)) {
            X402PayUSDCFactory factory = (X402PayUSDCFactory) REGISTRY.get(X402PayUSDC.class);
            return factory.buildRequirements((X402PayUSDC) a, request);
        } else if (a.annotationType().equals(X402PaymentRequirements.class)) {
            X402PaymentRequirementsFactory factory = (X402PaymentRequirementsFactory) REGISTRY.get(X402PaymentRequirements.class);
            return factory.buildRequirements((X402PaymentRequirements) a, request);
        } else {
            throw new IllegalArgumentException("Unsupported annotation type: " + a.annotationType());
        }
    }

}
