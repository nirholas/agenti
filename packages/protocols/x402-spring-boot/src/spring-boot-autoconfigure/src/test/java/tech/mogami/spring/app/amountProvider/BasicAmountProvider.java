package tech.mogami.spring.app.amountProvider;

import jakarta.servlet.http.HttpServletRequest;
import tech.mogami.spring.pricing.AmountProvider;

import java.math.BigDecimal;

public class BasicAmountProvider implements AmountProvider {

    @Override
    public BigDecimal getAmount(HttpServletRequest request) {
        final String type = request.getParameter("type");
        if (type == null) {
            return new BigDecimal("3001");
        } else {
            return switch (type) {
                case "image" -> new BigDecimal("1001");
                case "text" -> new BigDecimal("2001");
                default -> new BigDecimal("3001");
            };
        }
    }

}
