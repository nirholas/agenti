package tech.mogami.spring.pricing;

import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;

/**
 * Amount Provider.
 */
@FunctionalInterface
public interface AmountProvider {

    /**
     * Return the amount to pay in atomic units of the asset.
     *
     * @param request HTTP request
     * @return Amount to pay
     */
    BigDecimal getAmount(HttpServletRequest request);

}
