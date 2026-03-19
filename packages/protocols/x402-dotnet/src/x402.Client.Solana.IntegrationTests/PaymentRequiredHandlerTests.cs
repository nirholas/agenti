using System.Net.Http.Json;
using x402.Client.v2;
using x402.Core.Models.v2;

namespace x402.Client.Solana.IntegrationTests
{
    public class PaymentRequiredHandlerTests
    {
        private const string TestMnemonic = "logic consider obey pass bottom artist link tobacco need this month holiday";

        [SetUp]
        public void Setup()
        {
        }

        [Test]
        public async Task TestWithAllowance()
        {
            // Fixed private key for testing - NEVER use in production
            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;

            var handlerV2 = PaymentRequiredV2Handler.Create(new x402.Client.v2.WalletProvider(wallet));

            var client = new HttpClient(handlerV2);

            // Test against Solana-enabled endpoints
            // Note: These endpoints would need to support Solana payments
            // Uncomment the appropriate endpoint for testing
            //var response = await client.GetAsync("https://solana-x402-endpoint.example.com/protected");
            //var response = await client.GetAsync("https://localhost:7154/solana/protected");

            // For now, using a mock endpoint
            var response = await client.GetAsync("https://httpbin.org/status/200");

            Assert.That(response.IsSuccessStatusCode, Is.True);
            Console.WriteLine($"Final: {(int)response.StatusCode} {response.ReasonPhrase}");
        }

        /// <summary>
        /// This test does not first request payment details, but directly submits the payment header
        /// </summary>
        /// <returns></returns>
        [Test]
        public async Task TestWithoutHandler()
        {
            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;

            PaymentPayloadHeader header = await wallet.CreateHeaderAsync(new PaymentRequirements
            {
                Asset = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana devnet
                Amount = "10000",
                Network = "solana-devnet",
                PayTo = "9aKq3TqzQPq3K1Wc2YrqvZjXRzVsKGRqJhHGQqKvYpVZ",
                Extra = new x402.Core.Models.v2.PaymentRequirementsExtra
                {
                    Name = "USDC",
                    Version = "1",
                }
            });

            var client = new HttpClient();

            var request = new HttpRequestMessage(HttpMethod.Get, "https://httpbin.org/status/200");
            request.AddPaymentHeader(header);

            var response = await client.SendAsync(request);

            Assert.That(response.IsSuccessStatusCode, Is.True);
            Console.WriteLine($"Final: {(int)response.StatusCode} {response.ReasonPhrase}");
        }

        [Test]
        public async Task TestPost()
        {
            var wallet = SolanaWallet.FromMnemonic(TestMnemonic, "", 0, "solana-devnet");
            wallet.IgnoreAllowances = true;

            var handler = PaymentRequiredV2Handler.Create(new x402.Client.v2.WalletProvider(wallet));

            var client = new HttpClient(handler);

            var req = new
            {
                Name = "x402-dotnet-solana",
                Message = "Test Solana Payment",
            };

            var response = await client.PostAsJsonAsync("https://httpbin.org/post", req);
            var respText = await response.Content.ReadAsStringAsync();

            Assert.That(response.IsSuccessStatusCode, Is.True);
            Console.WriteLine($"Final: {(int)response.StatusCode} {response.ReasonPhrase}");
        }
    }
}
