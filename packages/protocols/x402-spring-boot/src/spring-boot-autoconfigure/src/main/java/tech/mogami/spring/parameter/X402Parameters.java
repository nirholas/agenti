package tech.mogami.spring.parameter;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.hibernate.validator.constraints.URL;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import tech.mogami.commons.validator.BlockchainAddress;
import tech.mogami.commons.validator.NetworkId;

/**
 * X402 Parameters.
 *
 * @param facilitator    facilitator parameters
 * @param defaultNetwork default blockchain network (e.g., "base-sepolia", "base")
 * @param defaultPayTo   default recipient wallet address
 */
@Validated
@SuppressWarnings("unused")
@ConfigurationProperties(prefix = "x402")
public record X402Parameters(

        @Valid
        @NotNull(message = "{validation.facilitator.empty}")
        Facilitator facilitator,

        @NotBlank(message = "{validation.default-network.empty}")
        @NetworkId(message = "{validation.default-network.invalid}")
        String defaultNetwork,

        @NotBlank(message = "{validation.default-payTo.empty}")
        @BlockchainAddress(message = "{validation.default-payTo.invalid}")
        String defaultPayTo

) {

    /**
     * Facilitator parameters.
     *
     * @param baseUrl the base URL of the facilitator
     */
    public record Facilitator(

            @NotEmpty(message = "{validation.facilitator.base-url.empty}")
            @URL(message = "{validation.facilitator.base-url.invalid}")
            String baseUrl

    ) {
    }

}

