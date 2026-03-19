using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using x402.Core.Enums;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;
using x402.Facilitator;

namespace x402.Tests
{
    [TestFixture]
    public class HttpFacilitatorClientTests
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

        private static HttpFacilitatorClient CreateClient(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            var handler = new FakeHandler { Impl = responder };
            var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://facilitator.local") };
            var logger = new NullLogger<HttpFacilitatorClient>();
            return new HttpFacilitatorClient(httpClient, logger);
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
        public async Task VerifyAsync_Success_DeserializesResponse()
        {
            var expected = new VerificationResponse { IsValid = true };
            var client = CreateClient(req =>
            {
                Assert.That(req.RequestUri!.ToString(), Does.Contain("/verify"));
                var msg = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = JsonContent.Create(expected, options: new JsonSerializerOptions(JsonSerializerDefaults.Web))
                };
                return msg;
            });

            var result = await client.VerifyAsync(emptyPayloadHeader, CreateReqs());
            Assert.That(result.IsValid, Is.True);
        }

        [Test]
        public void VerifyAsync_NonSuccess_Throws()
        {
            var client = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("oops")
            });

            Assert.ThrowsAsync<HttpRequestException>(async () => await client.VerifyAsync(emptyPayloadHeader, CreateReqs()));
        }

        [Test]
        public async Task SettleAsync_Success_DeserializesResponse()
        {
            var expected = new SettlementResponse { Success = true, Transaction = "0xabc", Network = "eip155:84532" };
            var client = CreateClient(req =>
            {
                Assert.That(req.RequestUri!.ToString(), Does.Contain("/settle"));
                var msg = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = JsonContent.Create(expected, options: new JsonSerializerOptions(JsonSerializerDefaults.Web))
                };
                return msg;
            });

            var result = await client.SettleAsync(emptyPayloadHeader, CreateReqs());
            Assert.That(result.Success, Is.True);
            Assert.That(result.Transaction, Is.EqualTo("0xabc"));
        }

        [Test]
        public void SettleAsync_NonSuccess_Throws()
        {
            var client = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("fail")
            });
            Assert.ThrowsAsync<HttpRequestException>(async () => await client.SettleAsync(emptyPayloadHeader, CreateReqs()));
        }

        [Test]
        public async Task SupportedAsync_ParsesKinds()
        {
            var payload = new
            {
                kinds = new object[]
                {
                    new { Network = "coinbase" }
                }
            };

            var client = CreateClient(_ =>
            {
                var msg = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = JsonContent.Create(payload, options: new JsonSerializerOptions(JsonSerializerDefaults.Web))
                };
                return msg;
            });

            var result = await client.SupportedAsync();
            Assert.That(result, Is.Not.Null);
            Assert.That(result.Kinds.Count, Is.EqualTo(1));
            Assert.That(result.Kinds[0].Network, Is.EqualTo("coinbase"));
        }
    }
}


