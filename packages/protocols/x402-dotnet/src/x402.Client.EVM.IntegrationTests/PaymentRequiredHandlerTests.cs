using System.Net.Http.Json;
using x402.Client.v2;
using x402.Core.Models.v2;

namespace x402.Client.EVM.IntegrationTests
{
    public class PaymentRequiredHandlerTests
    {
        [SetUp]
        public void Setup()
        {
        }

        [Test]
        public async Task TestWithAllowance()
        {
            var wallet = new EVMWallet("0x0123454242abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "eip155:84532", 84532UL) //base-sepolia chain ID
            {
                IgnoreAllowances = true
            };

            //Handle V2 payment required responses
            var handlerV2 = PaymentRequiredV2Handler.Create(new v2.WalletProvider(wallet));

            var client = new HttpClient(handlerV2);

            //var response = await client.GetAsync("https://x402-dotnet.azurewebsites.net/Resource/protected");
            //var response = await client.GetAsync("https://localhost:7154/resource/protected");
            //var response = await client.GetAsync("https://localhost:44381/ResourceV2/protected");
            var response = await client.GetAsync("https://www.x402.org/protected");
            //var response = await client.GetAsync("https://helius.api.corbits.dev/");
            //var response = await client.GetAsync("https://proxy402.com/Z6lePs160M");

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
            var wallet = new EVMWallet("0x0123454242abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "eip155:84532", 84532UL) //base-sepolia chain ID
            {
                IgnoreAllowances = true
            };

            PaymentPayloadHeader header = await wallet.CreateHeaderAsync(new PaymentRequirements
            {
                Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                Amount = "10000",
                Network = "eip155:84532",
                PayTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
                MaxTimeoutSeconds = 300,
                Extra = new PaymentRequirementsExtra
                {
                    Name = "USDC",
                    Version = "2",
                }
            });

            var client = new HttpClient();


            var request = new HttpRequestMessage(HttpMethod.Get, "https://www.x402.org/protected");
            request.AddPaymentHeader(header);

            var response = await client.SendAsync(request);

            Assert.That(response.IsSuccessStatusCode, Is.True);
            Console.WriteLine($"Final: {(int)response.StatusCode} {response.ReasonPhrase}");
        }


        [Test]
        public async Task TestPost()
        {
            var wallet = new EVMWallet("0x0123454242abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "eip155:84532", 84532UL) //base-sepolia chain ID
            {
                IgnoreAllowances = true
            };
            var handler = PaymentRequiredV2Handler.Create(new v2.WalletProvider(wallet));

            var client = new HttpClient(handler);

            var req = new
            {
                Name = "x402-dotnet",
                Message = "Test",
            };

            var response = await client.PostAsJsonAsync("https://localhost:44310/PublicMessage/send-msg", req);
            var respText = await response.Content.ReadAsStringAsync();

            Assert.That(response.IsSuccessStatusCode, Is.True);
            Console.WriteLine($"Final: {(int)response.StatusCode} {response.ReasonPhrase}");
        }
    }
}
