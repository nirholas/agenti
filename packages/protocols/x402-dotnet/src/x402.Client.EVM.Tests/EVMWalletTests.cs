using x402.Core.Enums;
using x402.Core.Models.v2;

namespace x402.Client.EVM.Tests
{
    public class EVMWalletTests
    {
        private static PaymentRequirements BuildRequirement()
        {
            return new PaymentRequirements
            {
                Scheme = PaymentScheme.Exact,
                Network = "eip155:84532",
                Amount = "1000",
                Asset = "0x0000000000000000000000000000000000000000",
                PayTo = "0x1111111111111111111111111111111111111111",
            };
        }

        [Test]
        public async Task RequestPaymentAsync_BuildsHeaderWithExpectedMappings()
        {
            // Arrange
            var requirement = BuildRequirement();
            var requirements = new List<PaymentRequirements> { requirement };

            // Fixed private key (32 bytes hex) for deterministic address; signature will still vary due to nonce/time
            var wallet = new EVMWallet("0x0123454242abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "eip155:84532", 84532UL) //base-sepolia chain ID
            {
                IgnoreAllowances = true
            };

            // Act
            var selected = await wallet.SelectPaymentAsync(new PaymentRequiredResponse() { Resource = new ResourceInfo { Url = "https://localhost/test" }, Accepts = requirements }, CancellationToken.None);
            var header = await wallet.CreateHeaderAsync(selected!, CancellationToken.None);

            // Assert
            Assert.That(selected, Is.Not.Null);
            Assert.That(header, Is.Not.Null);

            Assert.That(header!.Accepted.Network, Is.EqualTo(requirement.Network));
            Assert.That(header.Accepted.Scheme, Is.EqualTo(requirement.Scheme));
            Assert.That(header.X402Version, Is.EqualTo(2));

            Assert.That(header.Payload, Is.Not.Null);
            Assert.That(string.IsNullOrWhiteSpace(header.Payload.Signature), Is.False);

            var auth = header.Payload.Authorization;
            Assert.That(auth, Is.Not.Null);
            Assert.That(auth.To, Is.EqualTo(requirement.PayTo));

            // Basic format checks
            Assert.That(auth.From, Does.StartWith("0x"));
            Assert.That(auth.From!.Length, Is.EqualTo(42)); // 0x + 40 hex chars
            Assert.That(auth.Nonce, Does.StartWith("0x"));
            Assert.That(auth.Nonce!.Length, Is.EqualTo(66)); // 0x + 64 hex chars (bytes32)
            Assert.That(ulong.Parse(auth.ValidBefore), Is.GreaterThan(long.Parse(auth.ValidAfter)));
        }

        [Test]
        public async Task RequestPaymentAsync_GeneratesEip712SignatureFormat()
        {
            // Arrange
            var requirements = new List<PaymentRequirements> { BuildRequirement() };
            var wallet = new EVMWallet("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "eip155:84532", 84532UL) //base-sepolia chain ID
            {
                IgnoreAllowances = true
            };

            // Act
            var selected = await wallet.SelectPaymentAsync(new PaymentRequiredResponse() { Resource = new ResourceInfo { Url = "https://localhost/test" }, Accepts = requirements }, CancellationToken.None);
            var header = await wallet.CreateHeaderAsync(selected!, CancellationToken.None);

            // Assert
            Assert.That(header, Is.Not.Null);
            var sig = header!.Payload.Signature;
            Assert.That(sig, Does.StartWith("0x"));
            Assert.That(sig.Length, Is.EqualTo(132)); // 0x + 130 hex chars (65 bytes)
        }
    }
}


