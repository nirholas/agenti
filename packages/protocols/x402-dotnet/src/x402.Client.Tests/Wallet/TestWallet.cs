using x402.Client.Models;

namespace x402.Client.Tests.Wallet
{
    public class TestWallet : BaseWallet
    {
        public int Version { get; set; } = 2;

        public TestWallet(List<AssetAllowance> assetAllowances) : base("eip155:84532")
        {
            AssetAllowances = assetAllowances;
        }

        public override Task<Core.Models.v2.PaymentPayloadHeader> CreateHeaderAsync(Core.Models.v2.PaymentRequirements requirement, CancellationToken cancellationToken = default)
        {
            var header = new Core.Models.v2.PaymentPayloadHeader()
            {
                X402Version = 2,
                Accepted = requirement,
                Payload = new Core.Models.v2.Payload
                {
                    Signature = "",
                    Authorization = new Core.Models.v2.Authorization
                    {
                        Value = "1",
                        From = "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37",
                        To = requirement.PayTo,

                    }
                },
            };

            return Task.FromResult(header);
        }
    }
}
