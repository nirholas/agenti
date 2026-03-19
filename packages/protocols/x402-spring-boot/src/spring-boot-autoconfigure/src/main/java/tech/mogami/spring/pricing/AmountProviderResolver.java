package tech.mogami.spring.pricing;


import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.NoSuchBeanDefinitionException;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Resolves the amount (fixed or dynamic) for an @X402Pay annotation.
 * <p>
 * Handles both static amounts declared directly in the annotation and
 * dynamic amounts computed via {@link AmountProvider} implementations.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AmountProviderResolver {

    /** Application context for bean retrieval. */
    private final ApplicationContext context;

    /**
     * Resolves the amount in atomic units based on the annotation configuration.
     *
     * @param amountInAnnotation the static amount defined in the annotation
     * @param providerClass      the AmountProvider class defined in the annotation
     * @param request            the HTTP servlet request
     * @return the resolved amount in atomic units as a String
     * @throws IllegalStateException if the provider returns a null amount or cannot be instantiated
     */
    public String resolveAmountInAtomicUnit(final String amountInAnnotation,
                                            final Class<? extends AmountProvider> providerClass,
                                            final HttpServletRequest request) {

        // Case 1: static amount (no provider) =========================================================================
        if (providerClass == null || providerClass == DefaultAmountProvider.class) {
            log.debug("Using static amount from annotation: {}", amountInAnnotation);
            return amountInAnnotation;
        }

        // Case 2: dynamic provider ====================================================================================
        BigDecimal amount = instantiateProvider(providerClass).getAmount(request);
        if (amount == null) {
            throw new IllegalStateException("AmountProvider " + providerClass.getName() + " returned null amount");
        }
        log.debug("Resolved dynamic amount from provider {} -> {}", providerClass.getSimpleName(), amount);
        return amount.toPlainString();
    }

    /**
     * Instantiates the AmountProvider, either from the Spring context or via reflection.
     *
     * @param providerClass the AmountProvider class to instantiate
     * @return the instantiated AmountProvider
     * @throws IllegalStateException if instantiation fails
     */
    private AmountProvider instantiateProvider(final Class<? extends AmountProvider> providerClass) {
        try {
            return context.getBean(providerClass);
        } catch (NoSuchBeanDefinitionException e) {
            try {
                log.debug("Provider {} not found as Spring bean, instantiating manually", providerClass.getName());
                return providerClass.getDeclaredConstructor().newInstance();
            } catch (Exception ex) {
                throw new IllegalStateException("Unable to instantiate AmountProvider: " + providerClass.getName(), ex);
            }
        }
    }

}
