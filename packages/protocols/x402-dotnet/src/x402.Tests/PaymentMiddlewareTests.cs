using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;
using x402.Core;
using x402.Core.Enums;
using x402.Core.Interfaces;
using x402.Core.Models;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;
using x402.Facilitator;
using x402.Models;

namespace x402.Tests
{
    [TestFixture]
    public class PaymentMiddlewareTests
    {

        private static IHost BuildHost(PaymentMiddlewareOptions options, IFacilitatorV2Client facilitatorClientV2)
        {
            return new HostBuilder()
                .ConfigureLogging(b => b.AddDebug().AddConsole().SetMinimumLevel(LogLevel.Debug))
                .ConfigureWebHost(builder =>
                {
                    builder.UseTestServer();
                    builder.ConfigureServices(s =>
                    {
                        s.AddSingleton<IFacilitatorV2Client>(facilitatorClientV2);
                        s.AddSingleton<X402HandlerV2>();
                        s.AddSingleton<IAssetInfoProvider, AssetInfoProvider>();
                        s.AddHttpContextAccessor();
                    });
                    builder.Configure(app =>
                    {
                        app.UsePaymentMiddleware(options);
                        app.Run(async ctx => await ctx.Response.WriteAsync("ok"));
                    });
                }).Start();
        }

        private static string CreateHeaderJson(PaymentRequirements accepted, string? resource = null, string? from = null, string to = "0x0000000000000000000000000000000000000001", string value = "1")
        {
            var payload = new
            {
                x402Version = 2,
                accepted = accepted,
                payload = new Dictionary<string, object?>
                {
                    { "authorization", new Dictionary<string, object?> {
                        { "from", from ?? "0xF00" },
                        { "to", to } ,
                        { "value", value },
                        { "validBefore", DateTimeOffset.UtcNow.AddSeconds(5).ToUnixTimeSeconds().ToString() },
                        { "validAfter", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString() }
                    } },
                    { "resource", $"http://localhost{resource}" }
                }
            };
            return JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }

        private static string CreateHeaderB64(PaymentRequirements accepted, string? resource = null, string? from = null)
        {
            string json = CreateHeaderJson(accepted, resource, from, accepted.PayTo, accepted.Amount);
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
        }

        [Test]
        public async Task NoConfiguredPath_AllowsPipeline()
        {
            var options = new PaymentMiddlewareOptions
            {
                PaymentRequirements = new Dictionary<string, PaymentRequirementsConfig>()
            };

            using var host = BuildHost(options, new FakeFacilitatorClient());
            var client = host.GetTestClient();
            var resp = await client.GetAsync("/free");
            Assert.That(resp.IsSuccessStatusCode, Is.True);
        }

        [Test]
        public async Task ConfiguredPath_NoHeader_Returns402()
        {
            var options = new PaymentMiddlewareOptions
            {
                PaymentRequirements = new Dictionary<string, PaymentRequirementsConfig>
                {
                    ["/pay"] = new PaymentRequirementsConfig
                    {
                        PaymentRequirements = new PaymentRequiredInfo
                        {
                            Resource = new ResourceInfoBasic
                            {
                                MimeType = "application/json",
                                Description = "unit",
                            },
                            Accepts = new List<PaymentRequirementsBasic>()
                            {
                                new PaymentRequirementsBasic
                                {
                                    Scheme = PaymentScheme.Exact,
                                    Amount = "100000",
                                    Asset = "USDC",
                                    PayTo = "0x"
                                }
                            },
                            Discoverable = false
                        },
                    }
                }
            };

            using var host = BuildHost(options, new FakeFacilitatorClient());
            var client = host.GetTestClient();
            var resp = await client.GetAsync("/pay");
            Assert.That(resp.StatusCode, Is.EqualTo((System.Net.HttpStatusCode)StatusCodes.Status402PaymentRequired));
        }

        [Test]
        public async Task ConfiguredPath_ValidHeader_AllowsAndSetsResponseHeader()
        {
            var fake = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xsettle", Network = req.Network })
            };
            var options = new PaymentMiddlewareOptions
            {
                PaymentRequirements = new Dictionary<string, PaymentRequirementsConfig>
                {
                    ["/payok"] = new PaymentRequirementsConfig
                    {
                        PaymentRequirements = new PaymentRequiredInfo
                        {
                            Resource = new ResourceInfoBasic
                            {
                                MimeType = "application/json",
                                Description = "unit",
                            },
                            Accepts = new List<PaymentRequirementsBasic>()
                            {
                                new PaymentRequirementsBasic
                                {
                                    Scheme = PaymentScheme.Exact,
                                    Amount = "100000",
                                    Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                                    PayTo = "0x"
                                }
                            },
                        },
                        Version = 2
                    },
                },
            };

            var pr = new PaymentRequirements
            {
                Scheme = PaymentScheme.Exact,
                Amount = "100000",
                Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                PayTo = "0x",
                Network = "eip155:84532",
            };

            using var host = BuildHost(options, fake);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/payok");
            request.Headers.Add(X402HandlerV2.PaymentHeaderV2, CreateHeaderB64(pr, "http://localhost/payok", "100000"));
            var resp = await client.SendAsync(request);
            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(resp.Headers.Contains(X402HandlerV2.PaymentResponseHeaderV2), Is.True);
        }
    }
}


