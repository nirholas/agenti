using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using x402.Coinbase.Models;
using x402.Core.Enums;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;

namespace x402.Coinbase.Tests
{
    [TestFixture]
    public class CoinbaseFacilitatorClientTests
    {
        private readonly PaymentPayloadHeader emptyPayloadHeader = new PaymentPayloadHeader()
        {
            X402Version = 2,
            Payload = new Payload()
            {
                Authorization = new()
            },
            Accepted = new PaymentRequirements()
            {
                Amount = "1",
                Asset = "USDC",
                Network = "eip155:84532",
                PayTo = "0x"
            }
        };
        private sealed class FakeHandler : HttpMessageHandler
        {
            public Func<HttpRequestMessage, HttpResponseMessage>? Impl { get; set; }
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                if (Impl != null) return Task.FromResult(Impl(request));
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            }
        }

        private static PaymentRequirements CreateReqs(string resource = "/r") => new PaymentRequirements
        {
            Asset = "USDC",
            Amount = "1",
            Network = "eip155:84532",
            PayTo = "0x0000000000000000000000000000000000000001",
            Scheme = PaymentScheme.Exact,
            MaxTimeoutSeconds = 30
        };

        [Test]
        public async Task VerifyAsync_UsesBaseUrl_AndAddsBearerAuth()
        {
            string? capturedUrl = null;
            string? capturedAuth = null;

            var handler = new FakeHandler
            {
                Impl = req =>
                {
                    capturedUrl = req.RequestUri?.ToString();
                    capturedAuth = req.Headers.Authorization?.ToString();
                    var body = new VerificationResponse { IsValid = true };
                    return new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = JsonContent.Create(body, options: new JsonSerializerOptions(JsonSerializerDefaults.Web))
                    };
                }
            };

            var httpClient = new HttpClient(handler);
            var options = Options.Create(new CoinbaseOptions
            {
                BaseUrl = "https://api.example.com",
                ApiKeyId = "test-id",
                ApiKeySecret = Convert.ToBase64String(new byte[64])
            });

            var client = new CoinbaseFacilitatorClient(httpClient, options, NullLoggerFactory.Instance);

            var result = await client.VerifyAsync(emptyPayloadHeader, CreateReqs("/r"));

            Assert.That(result.IsValid, Is.True);
            Assert.That(capturedUrl, Is.EqualTo("https://api.example.com/verify"));
            Assert.That(capturedAuth, Is.Not.Null);
            Assert.That(capturedAuth, Does.StartWith("Bearer "));
        }
    }
}


