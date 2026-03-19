package tech.mogami.spring.annotation;

import tech.mogami.spring.pricing.AmountProvider;
import tech.mogami.spring.pricing.DefaultAmountProvider;

import java.lang.annotation.Documented;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;
import static tech.mogami.commons.constant.X402Constants.X402_DEFAULT_PAYMENT_TIMEOUT_SECONDS;
import static tech.mogami.commons.payment.schemes.exact.ExactSchemeConstants.EXACT_SCHEME_NAME;

/**
 * X402 Pay USDC annotation.
 */
@Repeatable(X402PayUSDC.List.class)
@Target(METHOD)
@Retention(RUNTIME)
@Documented
@X402Pay
public @interface X402PayUSDC {

    /**
     * Scheme of the payment protocol to use ("exact" by default).
     *
     * @return the scheme
     */
    String scheme() default EXACT_SCHEME_NAME;

    /**
     * Blockchain network identifier in CAIP-2 format (e.g., "eip155:84532").
     *
     * @return the network
     */
    String network() default "";

    /**
     * Amount required to pay for the resource in units of the asset.
     * example: "10.5" USDC
     * It won't be taken into account if an AmountProvider is provided.
     *
     * @return the amount
     */
    String amount();

    /**
     * Class providing the amount to pay.
     * If you want to use a fixed price, use the amount field.
     * But if you want to calculate a price depending on the user request,
     * provide your AmountProvider implementation, amount field will be ignored.
     *
     * @return the amount provider class
     */
    Class<? extends AmountProvider> amountProvider() default DefaultAmountProvider.class;

    /**
     * Recipient wallet address for the payment.
     *
     * @return the address
     */
    String payTo() default "";

    /**
     * Maximum timeout required to complete the payment in seconds.
     *
     * @return the timeout
     */
    int maximumTimeoutSeconds() default X402_DEFAULT_PAYMENT_TIMEOUT_SECONDS;

    /**
     * X402PayUSDC list.
     */
    @Target(METHOD)
    @Retention(RUNTIME)
    @Documented
    @interface List {
        @SuppressWarnings("UnusedReturnValue")
        X402PayUSDC[] value();
    }

}
