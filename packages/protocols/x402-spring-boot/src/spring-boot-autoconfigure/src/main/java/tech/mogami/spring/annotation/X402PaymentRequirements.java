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

/**
 * X402 Payment requirements annotation.
 */
@Repeatable(X402PaymentRequirements.List.class)
@Retention(RUNTIME)
@Target({METHOD})
@Documented
@X402Pay
public @interface X402PaymentRequirements {

    /**
     * Scheme of the payment protocol to use (e.g., "exact").
     *
     * @return the scheme
     */
    String scheme();

    /**
     * Blockchain network identifier in CAIP-2 format (e.g., "eip155:84532").
     *
     * @return the network
     */
    String network();

    /**
     * Required payment amount in atomic token units.
     *
     * @return Required payment amount in atomic token units
     */
    String amount();

    /**
     * Token contract address or ISO 4217 currency code for fiat.
     *
     * @return the contract address
     */
    String asset();

    /**
     * Recipient wallet address or role constant (e.g., "merchant").
     *
     * @return the address or role
     */
    String payTo();

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
     * Maximum timeout required to complete the payment in seconds.
     *
     * @return the timeout
     */
    int maximumTimeoutSeconds() default X402_DEFAULT_PAYMENT_TIMEOUT_SECONDS;

    /**
     * Extra information about the payment details specific to the scheme.
     * For `exact` scheme on an EVM network, expect extra to contain the records `name` and `version`
     * pertaining to asset
     *
     * @return Extra information about the payment details specific to the scheme
     */
    ExtraEntry[] extra() default {};

    /**
     * Extra entry.
     */
    @interface ExtraEntry {

        /**
         * Key of the extra entry.
         *
         * @return the key
         */
        String key();

        /**
         * Value of the extra entry.
         *
         * @return the value
         */
        String value();

    }

    /**
     * X402 list.
     */
    @Target(METHOD)
    @Retention(RUNTIME)
    @Documented
    @interface List {
        @SuppressWarnings("UnusedReturnValue")
        X402PaymentRequirements[] value();
    }

}
