package tech.mogami.spring.app.integration;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.mogami.spring.annotation.X402PayUSDC;
import tech.mogami.spring.annotation.X402PaymentRequirements;
import tech.mogami.spring.annotation.X402Resource;
import tech.mogami.spring.test.util.BaseTest;

@SuppressWarnings("SameReturnValue")
@RestController
public class ProtectedController extends BaseTest {

    @X402Resource(
            url = "https://www.x402.org/protected",
            description = "Access to protected content",
            mimeType = ""
    )
    @X402PayUSDC(
            amount = "0.01",
            payTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
            network = "eip155:84532",
            maximumTimeoutSeconds = 300
    )
    @X402PaymentRequirements(
            scheme = "exact",
            network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            amount = "10000",
            payTo = "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5",
            asset = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            maximumTimeoutSeconds = 300,
            extra = {
                    @X402PaymentRequirements.ExtraEntry(key = "feePayer", value = "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5")
            }
    )
    @GetMapping("/protected")
    public String protectedService() {
        return "Your payment was successful!";
    }

}
