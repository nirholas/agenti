using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using x402.Client.EVM;
using x402.Core;
using x402.Core.Enums;
using x402.Core.Models.v2;
using x402.Facilitator;

namespace x402.IntegrationTests.Facilitator
{
    [TestFixture]
    public class HttpFacilitatorClientTests
    {
        private HttpFacilitatorClient client = null!;

        [OneTimeSetUp]
        public void GlobalSetup()
        {
            // Load secrets from user-secrets or appsettings.json
            var config = new ConfigurationBuilder()
                .AddUserSecrets<HttpFacilitatorClientTests>() // user-secrets
                .AddEnvironmentVariables() // support env vars in CI/CD
                .Build();

            var services = new ServiceCollection();

            services.AddHttpClient(); // registers IHttpClientFactory

            var provider = services.BuildServiceProvider();

            var apiUrl = "https://facilitator.payai.network";
            //var apiUrl = "https://www.x402.org/facilitator/";
            //var apiUrl = "https://facilitator.mogami.tech";
            //var apiUrl = "https://facilitator.mcpay.tech";
            //var apiUrl = "https://facilitator.daydreams.systems/";

            var httpClient = new HttpClient
            {
                BaseAddress = new Uri(apiUrl)
            };

            client = new HttpFacilitatorClient(httpClient, new NullLogger<HttpFacilitatorClient>());
        }

        [Test]
        public async Task SupportedAsync_ShouldReturnKinds()
        {
            var result = await client.SupportedAsync();

            Assert.That(result, Is.Not.Null);
            Assert.That(result.Kinds.Count, Is.GreaterThan(0));
            TestContext.Out.WriteLine($"Supported kinds: {string.Join(", ", result.Kinds.Select(k => k.ToString()))}");
        }

        [Test]
        public async Task VerifyAsync_ShouldReturnVerificationResponse()
        {
            var paymentHeader = "eyJ4NDAyVmVyc2lvbiI6MiwicGF5bG9hZCI6eyJzaWduYXR1cmUiOiIweDE5NDQ2ZDAxNDM2MTkxZTgyZjZiNjE4NmQ1NjdhNjdjYWM2MmZiN2VkMGQxMGUzNzE3YzhmYzU4YmI0ZDFkZmQzNDgxMTFhMTc1MDQ2ODFhOTA1OTcwZmRkY2IyMzIwMWQ0MTQwOGEzZDJmY2JhZTI5MzNhNWU5MTAzOTQwOTgzMWMiLCJhdXRob3JpemF0aW9uIjp7ImZyb20iOiIweDJBZjg5Y0NjYTgyNDY2NTM1Nzk2Mzk1MzIzMWI5QTJEM0I5RDU0MjEiLCJ0byI6IjB4MjA5NjkzQmM2YWZjMEM1MzI4YkEzNkZhRjAzQzUxNEVGMzEyMjg3QyIsInZhbHVlIjoiMTAwMDAiLCJ2YWxpZEFmdGVyIjoiMTc2Nzk2OTk1MSIsInZhbGlkQmVmb3JlIjoiMTc2Nzk3MDkxMSIsIm5vbmNlIjoiMHg3ZmI2N2YwNDRlNDhkM2U5MzYxOGRhNzg1MDE1NWQyNjZjNGI1OGZiZjljNGZiYWQwNGRkZTM3ZWQ2MGM4NDQwIn19LCJhY2NlcHRlZCI6eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMCIsImFzc2V0IjoiMHgwMzZDYkQ1Mzg0MmM1NDI2NjM0ZTc5Mjk1NDFlQzIzMThmM2RDRjdlIiwicGF5VG8iOiIweDIwOTY5M0JjNmFmYzBDNTMyOGJBMzZGYUYwM0M1MTRFRjMxMjI4N0MiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MzAwLCJleHRyYSI6eyJuYW1lIjoiVVNEQyIsInZlcnNpb24iOiIyIn19fQ==";
            var payload = PaymentPayloadHeader.FromHeader(paymentHeader);
            var requirements = new PaymentRequirements
            {
                Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                Amount = "10000",
                PayTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
                Network = "eip155:84532",
            };

            var result = await client.VerifyAsync(payload, requirements);

            Assert.That(result, Is.Not.Null);
            TestContext.Out.WriteLine($"Verify result: IsValid={result.IsValid}");
        }

        [Test]
        public async Task SettleAsync_ShouldReturnSettlementResponse()
        {
            var paymentHeader = "eyJ4NDAyVmVyc2lvbiI6MiwicGF5bG9hZCI6eyJzaWduYXR1cmUiOiIweDE5NDQ2ZDAxNDM2MTkxZTgyZjZiNjE4NmQ1NjdhNjdjYWM2MmZiN2VkMGQxMGUzNzE3YzhmYzU4YmI0ZDFkZmQzNDgxMTFhMTc1MDQ2ODFhOTA1OTcwZmRkY2IyMzIwMWQ0MTQwOGEzZDJmY2JhZTI5MzNhNWU5MTAzOTQwOTgzMWMiLCJhdXRob3JpemF0aW9uIjp7ImZyb20iOiIweDJBZjg5Y0NjYTgyNDY2NTM1Nzk2Mzk1MzIzMWI5QTJEM0I5RDU0MjEiLCJ0byI6IjB4MjA5NjkzQmM2YWZjMEM1MzI4YkEzNkZhRjAzQzUxNEVGMzEyMjg3QyIsInZhbHVlIjoiMTAwMDAiLCJ2YWxpZEFmdGVyIjoiMTc2Nzk2OTk1MSIsInZhbGlkQmVmb3JlIjoiMTc2Nzk3MDkxMSIsIm5vbmNlIjoiMHg3ZmI2N2YwNDRlNDhkM2U5MzYxOGRhNzg1MDE1NWQyNjZjNGI1OGZiZjljNGZiYWQwNGRkZTM3ZWQ2MGM4NDQwIn19LCJhY2NlcHRlZCI6eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJlaXAxNTU6ODQ1MzIiLCJhbW91bnQiOiIxMDAwMCIsImFzc2V0IjoiMHgwMzZDYkQ1Mzg0MmM1NDI2NjM0ZTc5Mjk1NDFlQzIzMThmM2RDRjdlIiwicGF5VG8iOiIweDIwOTY5M0JjNmFmYzBDNTMyOGJBMzZGYUYwM0M1MTRFRjMxMjI4N0MiLCJtYXhUaW1lb3V0U2Vjb25kcyI6MzAwLCJleHRyYSI6eyJuYW1lIjoiVVNEQyIsInZlcnNpb24iOiIyIn19fQ==";
            var payload = PaymentPayloadHeader.FromHeader(paymentHeader);
            var requirements = new PaymentRequirements
            {
                Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                Amount = "1",
                PayTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
                Network = "eip155:84532",
            };

            var result = await client.SettleAsync(payload, requirements);

            Assert.That(result, Is.Not.Null);
            TestContext.Out.WriteLine($"Settle result: Success={result.Success}");
        }

        [Test]
        public async Task DiscoveryAsync_ShouldReturnResources()
        {
            var apiUrl = "https://facilitator.payai.network";

            var httpClient = new HttpClient
            {
                BaseAddress = new Uri(apiUrl)
            };

            var payAiClient = new HttpFacilitatorClient(httpClient, new NullLogger<HttpFacilitatorClient>());

            var result = await payAiClient.DiscoveryAsync();

            Assert.That(result, Is.Not.Null);
            Assert.That(result.Items.Count, Is.GreaterThan(0));
        }

        [Test]
        public async Task FullTest()
        {
            var apiUrl = "https://facilitator.payai.network";
            //var apiUrl = "https://facilitator.mogami.tech";
            //var apiUrl = "https://facilitator.mcpay.tech";
            //var apiUrl = "https://facilitator.daydreams.systems/";
            //var apiUrl = "https://open.x402.host";
            //var apiUrl = "https://facilitator.dirtroad.dev";

            var httpClient = new HttpClient
            {
                BaseAddress = new Uri(apiUrl)
            };

            var facilitatorClient = new HttpFacilitatorClient(httpClient, new NullLogger<HttpFacilitatorClient>());

            var result = await facilitatorClient.SupportedAsync();


            var assetInfo = new AssetInfoProvider();

            foreach (var kind in result.Kinds)
            {
                TestContext.Out.WriteLine($"Supported kind: {kind}");

                var asset = assetInfo.GetAll()
                    .Where(x => x.NetworkType == Core.Models.NetworkType.EVM)
                    .Where(x => x.Network == kind.Network).FirstOrDefault();
                if (asset == null)
                {
                    TestContext.Out.WriteLine($"No asset found for network {kind.Network}, skipping...");
                    continue;
                }

                var wallet = new EVMWallet("0x1123454242abcdef0123456789abcdef0123456789abcdef0123456789abcdef", asset.Network, asset.ChainId)
                {
                    IgnoreAllowances = true
                };


                PaymentRequirements requirements = new PaymentRequirements()
                {
                    Asset = asset.ContractAddress,
                    Amount = "1000",
                    Network = kind.Network,
                    Scheme = PaymentScheme.Exact,
                    PayTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
                    Extra = new PaymentRequirementsExtra
                    {
                        Name = asset.Name,
                        Version = asset.Version,
                    }
                };

                PaymentPayloadHeader header = await wallet.CreateHeaderAsync(requirements);


                var verifyResult = await facilitatorClient.VerifyAsync(header, requirements);
                TestContext.Out.WriteLine($"Verify result for kind {kind}: IsValid={verifyResult.IsValid}");

                var settleResult = await facilitatorClient.SettleAsync(header, requirements);
                TestContext.Out.WriteLine($"Settle result for kind {kind}: IsValid={settleResult.Success}");

            }

        }
    }
}
