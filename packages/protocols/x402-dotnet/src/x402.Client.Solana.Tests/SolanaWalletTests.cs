using x402.Core.Enums;
using x402.Core.Models.v2;

namespace x402.Client.Solana.Tests
{
    public class SolanaWalletTests
    {
        private static PaymentRequirements BuildRequirement()
        {
            return new PaymentRequirements
            {
                Scheme = PaymentScheme.Exact,
                Network = "solana-devnet",
                Amount = "1000",
                Asset = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
                PayTo = "9aKq3TqzQPq3K1Wc2YrqvZjXRzVsKGRqJhHGQqKvYpVZ"
            };
        }

        private const string TestMnemonic = "logic consider obey pass bottom artist link tobacco need this month holiday";

        [Test]
        public async Task RequestPaymentAsync_BuildsHeaderWithExpectedMappings()
        {
            // Arrange
            var requirement = BuildRequirement();
            var requirements = new List<PaymentRequirements> { requirement };

            // Fixed private key (base58) for deterministic address
            // This is a test key - never use in production
            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;

            // Act
            var selected = await wallet.SelectPaymentAsync(new PaymentRequiredResponse()
            {
                Accepts = requirements,
                Resource = new x402.Core.Models.v2.ResourceInfo
                {
                    Url = "/resource/protected"
                }
            }, CancellationToken.None);
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

            // Basic format checks for Solana addresses (base58 encoded, typically 32-44 characters)
            Assert.That(auth.From, Is.Not.Null);
            Assert.That(auth.From!.Length, Is.GreaterThanOrEqualTo(32));
            Assert.That(auth.From.Length, Is.LessThanOrEqualTo(44));

            // Nonce should be base64 encoded (32 bytes = 44 characters in base64)
            Assert.That(auth.Nonce, Is.Not.Null);
            Assert.That(auth.Nonce!.Length, Is.GreaterThan(0));

            Assert.That(ulong.Parse(auth.ValidBefore), Is.GreaterThan(long.Parse(auth.ValidAfter)));
        }

        [Test]
        public async Task RequestPaymentAsync_GeneratesBase64SignatureFormat()
        {
            // Arrange
            var requirements = new List<PaymentRequirements> { BuildRequirement() };
            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;

            // Act
            var selected = await wallet.SelectPaymentAsync(new PaymentRequiredResponse()
            {
                Accepts = requirements,
                Resource = new x402.Core.Models.v2.ResourceInfo
                {
                    Url = "/resource/protected"
                }
            }, CancellationToken.None);
            var header = await wallet.CreateHeaderAsync(selected!, CancellationToken.None);

            // Assert
            Assert.That(header, Is.Not.Null);
            var sig = header!.Payload.Signature;
            Assert.That(string.IsNullOrWhiteSpace(sig), Is.False);

            // Solana signatures are base64-encoded (Ed25519 signatures are 64 bytes)
            // Base64 encoding of 64 bytes results in 88 characters (without padding) or with padding
            Assert.That(sig.Length, Is.GreaterThan(0));

            // Verify it's valid base64
            Assert.DoesNotThrow(() => Convert.FromBase64String(sig));
        }

        [Test]
        public async Task CreateHeader_UsesCorrectNetwork()
        {
            // Arrange
            var requirement = BuildRequirement();
            requirement.Network = "solana-mainnet";

            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-mainnet");
            wallet.IgnoreAllowances = true;

            // Act
            var header = await wallet.CreateHeaderAsync(requirement, CancellationToken.None);

            // Assert
            Assert.That(header, Is.Not.Null);
            Assert.That(header.Accepted.Network, Is.EqualTo("solana-mainnet"));
        }

        [Test]
        public async Task CreateHeader_SetsCorrectAmount()
        {
            // Arrange
            var requirement = BuildRequirement();
            requirement.Amount = "50000";

            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;

            // Act
            var header = await wallet.CreateHeaderAsync(requirement, CancellationToken.None);

            // Assert
            Assert.That(header, Is.Not.Null);
            Assert.That(header.Payload.Authorization.Value, Is.EqualTo("50000"));
        }

        [Test]
        public async Task CreateHeader_GeneratesUniqueNonces()
        {
            // Arrange
            var requirement = BuildRequirement();
            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;

            // Act
            var header1 = await wallet.CreateHeaderAsync(requirement, CancellationToken.None);
            var header2 = await wallet.CreateHeaderAsync(requirement, CancellationToken.None);

            // Assert
            Assert.That(header1.Payload.Authorization.Nonce, Is.Not.EqualTo(header2.Payload.Authorization.Nonce));
        }

        [Test]
        public async Task CreateHeader_SetsValidityWindow()
        {
            // Arrange
            var requirement = BuildRequirement();
            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;
            wallet.AddValidAfterFromNow = TimeSpan.FromMinutes(-2);
            wallet.AddValidBeforeFromNow = TimeSpan.FromMinutes(10);

            var beforeCreation = DateTimeOffset.UtcNow;

            // Act
            var header = await wallet.CreateHeaderAsync(requirement, CancellationToken.None);

            var afterCreation = DateTimeOffset.UtcNow;

            // Assert
            var validAfter = long.Parse(header.Payload.Authorization.ValidAfter);
            var validBefore = long.Parse(header.Payload.Authorization.ValidBefore);

            // ValidAfter should be around 2 minutes before now
            var expectedValidAfter = beforeCreation.AddMinutes(-2).ToUnixTimeSeconds();
            Assert.That(validAfter, Is.InRange(expectedValidAfter - 5, expectedValidAfter + 5));

            // ValidBefore should be around 10 minutes after now
            var expectedValidBefore = afterCreation.AddMinutes(10).ToUnixTimeSeconds();
            Assert.That(validBefore, Is.InRange(expectedValidBefore - 5, expectedValidBefore + 5));

            // ValidBefore should always be greater than ValidAfter
            Assert.That(validBefore, Is.GreaterThan(validAfter));
        }
    }
}
