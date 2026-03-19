package tech.mogami.spring.app.amountProvider;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.mogami.spring.annotation.X402PayUSDC;
import tech.mogami.spring.annotation.X402PaymentRequirements;

import static tech.mogami.commons.constant.network.contract.BaseContracts.BASE_SEPOLIA_USDC_CONTRACT;
import static tech.mogami.commons.test.BaseMogamiTestData.TEST_SERVER_WALLET_ADDRESS_1;

@SuppressWarnings("SameReturnValue")
@RestController
public class AmountProviderController {

    @X402PaymentRequirements(
            scheme = "exact",
            network = "eip155:84532",
            amount = "1000",
            amountProvider = BasicAmountProvider.class,
            payTo = TEST_SERVER_WALLET_ADDRESS_1,
            asset = BASE_SEPOLIA_USDC_CONTRACT,
            extra = {
                    @X402PaymentRequirements.ExtraEntry(key = "name", value = "USDC"),
                    @X402PaymentRequirements.ExtraEntry(key = "version", value = "2")
            }
    )
    @GetMapping("/dynamicAmountWithX402PaymentRequirements")
    public String dynamicAmountWithX402PaymentRequirements() {
        return "Non relevant dynamic amount endpoint";
    }

    @X402PaymentRequirements(
            scheme = "exact",
            network = "eip155:84532",
            amount = "1000",
            amountProvider = SpringAmountProvider.class,
            payTo = TEST_SERVER_WALLET_ADDRESS_1,
            asset = BASE_SEPOLIA_USDC_CONTRACT,
            extra = {
                    @X402PaymentRequirements.ExtraEntry(key = "name", value = "USDC"),
                    @X402PaymentRequirements.ExtraEntry(key = "version", value = "2")
            }
    )
    @GetMapping("/dynamicAmountWithX402PaymentRequirementsWithSpring")
    public String dynamicAmountWithX402PaymentRequirementsWithSpring() {
        return "Non relevant dynamic amount endpoint";
    }

    @X402PayUSDC(
            amount = "3.6",
            amountProvider = BasicAmountProvider.class
    )
    @GetMapping("/dynamicAmountWithX402PayUSDC")
    public String dynamicAmountWithX402PayUSDC() {
        return "Non relevant dynamic amount endpoint";
    }

    @X402PayUSDC(
            amount = "3.6",
            amountProvider = SpringAmountProvider.class
    )
    @GetMapping("/dynamicAmountWithX402PayUSDCWithSpring")
    public String dynamicAmountWithX402PayUSDCWithSpring() {
        return "Non relevant dynamic amount endpoint";
    }

}
