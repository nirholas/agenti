using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using x402.Coinbase.Models;
using x402.Core.Models.v2;


namespace x402.Coinbase.IntegrationTests
{
    [TestFixture]
    public class CoinbaseFacilitatorClientTests
    {
        private CoinbaseFacilitatorClient client = null!;

        [OneTimeSetUp]
        public void GlobalSetup()
        {
            // Load secrets from user-secrets or appsettings.json
            var config = new ConfigurationBuilder()
                .AddUserSecrets<CoinbaseFacilitatorClientTests>() // user-secrets
                .AddEnvironmentVariables() // support env vars in CI/CD
                .Build();

            var services = new ServiceCollection();

            services.AddHttpClient(); // registers IHttpClientFactory
            services.Configure<CoinbaseOptions>(config.GetSection("CoinbaseOptions"));

            var provider = services.BuildServiceProvider();

            var coinbaseOptions = provider.GetRequiredService<IOptions<CoinbaseOptions>>();

            client = new CoinbaseFacilitatorClient(new HttpClient(), coinbaseOptions, NullLoggerFactory.Instance);
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
            var result = await client.DiscoveryAsync();

            var missing = result.Items.Where(i => i.Accepts.Where(x => x.MaxAmountRequired == null).Any()).ToList();

            Assert.That(result, Is.Not.Null);
            Assert.That(result.Items.Count, Is.GreaterThan(0));
        }
    }
}
