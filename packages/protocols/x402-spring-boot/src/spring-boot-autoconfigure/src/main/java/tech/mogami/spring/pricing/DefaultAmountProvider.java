package tech.mogami.spring.pricing;

import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;

/**
 * Default Amount Provider (never used, it's just the default one in annotation).
 */
public class DefaultAmountProvider implements AmountProvider {

    @Override
    public final BigDecimal getAmount(final HttpServletRequest request) {
        throw new UnsupportedOperationException("DefaultAmountProvider should never be used");
    }

}
