package tech.mogami.spring.app.amountProvider;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import tech.mogami.spring.pricing.AmountProvider;

import java.math.BigDecimal;

@Component
public class SpringAmountProvider implements AmountProvider {

    @Override
    public BigDecimal getAmount(HttpServletRequest request) {
        final String type = request.getParameter("type");
        if (type == null) {
            return new BigDecimal("6002");
        } else {
            return switch (type) {
                case "image" -> new BigDecimal("4002");
                case "text" -> new BigDecimal("5002");
                default -> new BigDecimal("6002");
            };
        }
    }

}
