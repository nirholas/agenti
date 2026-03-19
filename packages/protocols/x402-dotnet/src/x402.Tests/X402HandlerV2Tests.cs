using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework.Internal;
using System.Text;
using System.Text.Json;
using x402.Core;
using x402.Core.Enums;
using x402.Core.Interfaces;
using x402.Core.Models;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;
using x402.Facilitator;

namespace x402.Tests
{
    [TestFixture]
    public class X402HandlerV2Tests
    {
        private Mock<IAssetInfoProvider> _assetInfoProviderMock = null!;
        private Mock<IHttpContextAccessor> _httpContextAccessorMock = null!;
        private X402HandlerV2 _handler = null!;

        [OneTimeSetUp]
        public void TestInitialize()
        {
            var _facilitatorMock = new Mock<IFacilitatorV2Client>();
            _assetInfoProviderMock = new Mock<IAssetInfoProvider>();
            _httpContextAccessorMock = new Mock<IHttpContextAccessor>();

            var httpContext = new DefaultHttpContext();
            httpContext.Request.Scheme = "https";
            httpContext.Request.Host = new HostString("localhost");
            _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);

            _handler = new X402HandlerV2(
                new NullLogger<X402HandlerV2>(),
                _facilitatorMock.Object,
                _assetInfoProviderMock.Object,
                _httpContextAccessorMock.Object);
        }



        private static IHost BuildHost(IFacilitatorV2Client facilitator,
            string path,
            PaymentRequirements requirements,
            SettlementMode mode = SettlementMode.Optimistic,
            Func<HttpContext, SettlementResponse?, Exception?, Task>? onSettlement = null,
            Action? onStartingMarker = null)
        {
            return BuildHost(facilitator, path, new ResourceInfo() { Url = $"http://localhost{path}" }, new List<PaymentRequirements> { requirements }, mode, onSettlement, onStartingMarker);
        }

        private static IHost BuildHost(IFacilitatorV2Client facilitator,
            string path,
            ResourceInfo resourceInfo,
            List<PaymentRequirements> requirements,
            SettlementMode mode = SettlementMode.Optimistic,
            Func<HttpContext, SettlementResponse?, Exception?, Task>? onSettlement = null,
            Action? onStartingMarker = null)
        {
            return new HostBuilder()
                .ConfigureLogging(b => b.AddDebug().AddConsole().SetMinimumLevel(LogLevel.Debug))
                .ConfigureWebHost(builder =>
                {
                    builder.UseTestServer();
                    builder.ConfigureServices(services =>
                    {
                        services.AddSingleton(facilitator);
                        services.AddSingleton<X402HandlerV2>();
                        services.AddSingleton<IAssetInfoProvider, AssetInfoProvider>();
                        services.AddHttpContextAccessor();

                    });
                    builder.Configure(app =>
                    {
                        app.Run(async context =>
                        {
                            // Test hook to verify Response.OnStarting is reachable in pipeline
                            context.Response.OnStarting(() =>
                            {
                                onStartingMarker?.Invoke();
                                return Task.CompletedTask;
                            });

                            // Invoke handler
                            var x402handler = context.RequestServices.GetRequiredService<X402HandlerV2>();
                            var result = await x402handler.HandleX402Async(
                                resourceInfo,
                                requirements,
                                true,
                                mode,
                                onSettlement).ConfigureAwait(false);

                            if (result.CanContinueRequest)
                            {
                                await context.Response.WriteAsync("ok").ConfigureAwait(false);
                            }
                        });
                    });
                })
                .Start();
        }

        private static PaymentRequirements CreateRequirements(string path)
        {
            return new PaymentRequirements
            {
                Scheme = PaymentScheme.Exact,
                Network = "eip155:84532",
                Amount = "1",
                Asset = "USDC",
                PayTo = "0x0000000000000000000000000000000000000001",
            };
        }

        private static PaymentRequirements CreateRequirements(string path, string payTo, string amount)
        {
            return new PaymentRequirements
            {
                Scheme = PaymentScheme.Exact,
                Network = "eip155:84532",
                Amount = amount,
                Asset = "USDC",
                PayTo = payTo,
            };
        }

        private static string CreateHeaderJson(PaymentRequirements accepted, string? resource = null, string? from = null, string? network = "eip155:84532", string to = "0x0000000000000000000000000000000000000001", string value = "1")
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

        private static string CreateHeaderB64(PaymentRequirements accepted, string? resource = null, string? from = null, string? network = "eip155:84532", string to = "0x0000000000000000000000000000000000000001", string value = "1")
        {
            string json = CreateHeaderJson(accepted, resource, from, network, to, value);
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
        }

        [Test]
        public async Task NoHeader_Returns402_AndCannotContinue()
        {
            var facilitator = new FakeFacilitatorClient();
            var reqs = CreateRequirements("/api");
            using var host = BuildHost(facilitator, "/api", reqs);
            var client = host.GetTestClient();

            var resp = await client.GetAsync("/api");

            Assert.That(resp.StatusCode, Is.EqualTo((System.Net.HttpStatusCode)StatusCodes.Status402PaymentRequired));
        }

        [Test]
        public async Task MalformedHeader_Returns402()
        {
            var facilitator = new FakeFacilitatorClient();
            var reqs = CreateRequirements("/res");
            using var host = BuildHost(facilitator, "/res", reqs);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/res");
            request.Headers.Add("PAYMENT-SIGNATURE", "not-base64");

            var resp = await client.SendAsync(request);

            Assert.That(resp.StatusCode, Is.EqualTo((System.Net.HttpStatusCode)StatusCodes.Status402PaymentRequired));
        }


        [Test]
        public async Task InvalidVerification_Returns402()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = false, InvalidReason = "bad" })
            };
            var reqs = CreateRequirements("/r");
            using var host = BuildHost(facilitator, "/r", reqs);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/r");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/r"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.StatusCode, Is.EqualTo((System.Net.HttpStatusCode)StatusCodes.Status402PaymentRequired));
        }

        [Test]
        public async Task Optimistic_SettlementSuccess_AddsHeader_AndContinue()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xdead", Network = req.Network })
            };
            var reqs = CreateRequirements("/ok");
            using var host = BuildHost(facilitator, "/ok", reqs, SettlementMode.Optimistic);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/ok");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/ok", from: "0xabc"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(resp.Headers.Contains("PAYMENT-RESPONSE"), Is.True);
            Assert.That(string.Join(',', resp.Headers.GetValues("Access-Control-Expose-Headers")), Does.Contain("PAYMENT-RESPONSE"));
        }

        [Test]
        public async Task Optimistic_SettlementFailure_OnRequest_Writes200()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, _) => Task.FromResult(new SettlementResponse { Success = false, ErrorReason = "settle failed" })
            };
            var reqs = CreateRequirements("/fail");
            using var host = BuildHost(facilitator, "/fail", reqs, SettlementMode.Optimistic);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/fail");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/fail"));

            var resp = await client.SendAsync(request);
            var content = await resp.Content.ReadAsStringAsync();

            Assert.That(resp.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.OK));
        }

        [Test]
        public async Task Pessimistic_SettlementFailure_Returns402_AndCannotContinue()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, _) => Task.FromResult(new SettlementResponse { Success = false, ErrorReason = "not enough" })
            };
            var reqs = CreateRequirements("/pess-fail");
            using var host = BuildHost(facilitator, "/pess-fail", reqs, SettlementMode.Pessimistic);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/pess-fail");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/pess-fail"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.StatusCode, Is.EqualTo((System.Net.HttpStatusCode)StatusCodes.Status402PaymentRequired));
        }

        [Test]
        public async Task Pessimistic_SettlementSuccess_AddsHeaderAndContinue()
        {
            bool callbackCalled = false;
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xbeef", Network = req.Network })
            };
            var reqs = CreateRequirements("/pess-ok");
            using var host = BuildHost(
                facilitator,
                "/pess-ok",
                reqs,
                SettlementMode.Pessimistic,
                onSettlement: (ctx, sr, ex) => { callbackCalled = true; return Task.CompletedTask; });
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/pess-ok");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/pess-ok", from: "0xabc"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(callbackCalled, Is.True);
            Assert.That(resp.Headers.Contains("PAYMENT-RESPONSE"), Is.True);
        }

        [Test]
        public async Task Version2_UsesPaymentSignatureHeader()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xdead", Network = req.Network })
            };
            var reqs = CreateRequirements("/v2-signature");
            using var host = BuildHost(facilitator, "/v2-signature", reqs, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-signature");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/v2-signature", from: "0xabc"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(resp.Headers.Contains("PAYMENT-RESPONSE"), Is.True);
            Assert.That(string.Join(',', resp.Headers.GetValues("Access-Control-Expose-Headers")), Does.Contain("PAYMENT-RESPONSE"));
        }


        [Test]
        public async Task Version2_NoHeader_Returns402WithPaymentRequiredHeader()
        {
            var facilitator = new FakeFacilitatorClient();
            var reqs = CreateRequirements("/v2-noheader");
            using var host = BuildHost(facilitator, "/v2-noheader", reqs, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-noheader");

            var resp = await client.SendAsync(request);

            // Version 2 returns 402 with PAYMENT-REQUIRED header
            Assert.That(resp.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.PaymentRequired));
            Assert.That(resp.Headers.Contains("PAYMENT-REQUIRED"), Is.True);
            Assert.That(string.Join(',', resp.Headers.GetValues("Access-Control-Expose-Headers")), Does.Contain("PAYMENT-REQUIRED"));
        }

        [Test]
        public async Task Version2_MalformedHeader_Returns402WithPaymentRequiredHeader()
        {
            var facilitator = new FakeFacilitatorClient();
            var reqs = CreateRequirements("/v2-malformed");
            using var host = BuildHost(facilitator, "/v2-malformed", reqs, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-malformed");
            request.Headers.Add("PAYMENT-SIGNATURE", "not-base64");

            var resp = await client.SendAsync(request);

            // Version 2 returns 402 with PAYMENT-REQUIRED header
            Assert.That(resp.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.PaymentRequired));
            Assert.That(resp.Headers.Contains("PAYMENT-REQUIRED"), Is.True);
        }

        [Test]
        public async Task Version2_InvalidVerification_Returns402WithPaymentRequiredHeader()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = false, InvalidReason = "bad signature" })
            };
            var reqs = CreateRequirements("/v2-bad");
            using var host = BuildHost(facilitator, "/v2-bad", reqs, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-bad");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/v2-bad"));

            var resp = await client.SendAsync(request);

            // Version 2 returns 402 with PAYMENT-REQUIRED header
            Assert.That(resp.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.PaymentRequired));
            Assert.That(resp.Headers.Contains("PAYMENT-REQUIRED"), Is.True);
        }

        [Test]
        public async Task Version2_Optimistic_SettlementSuccess_AddsPaymentResponseHeader()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xdead", Network = req.Network })
            };
            var reqs = CreateRequirements("/v2-ok");
            using var host = BuildHost(facilitator, "/v2-ok", reqs, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-ok");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/v2-ok", from: "0xabc"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(resp.Headers.Contains("PAYMENT-RESPONSE"), Is.True);
            var responseHeader = resp.Headers.GetValues("PAYMENT-RESPONSE").First();
            // Verify it's base64 encoded
            Assert.DoesNotThrow(() => Convert.FromBase64String(responseHeader));
        }

        [Test]
        public async Task Version2_Pessimistic_SettlementSuccess_AddsPaymentResponseHeader()
        {
            bool callbackCalled = false;
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xbeef", Network = req.Network })
            };
            var reqs = CreateRequirements("/v2-pess");
            using var host = BuildHost(
                facilitator,
                "/v2-pess",
                reqs,
                SettlementMode.Pessimistic,
                onSettlement: (ctx, sr, ex) => { callbackCalled = true; return Task.CompletedTask; },
                onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-pess");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/v2-pess", from: "0xabc"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(callbackCalled, Is.True);
            Assert.That(resp.Headers.Contains("PAYMENT-RESPONSE"), Is.True);
        }

        [Test]
        public async Task Version2_Pessimistic_SettlementFailure_Returns402WithPaymentRequiredHeader()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, _) => Task.FromResult(new SettlementResponse { Success = false, ErrorReason = "insufficient funds" })
            };
            var reqs = CreateRequirements("/v2-pess-fail");
            using var host = BuildHost(facilitator, "/v2-pess-fail", reqs, SettlementMode.Pessimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-pess-fail");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(reqs, resource: "/v2-pess-fail"));

            var resp = await client.SendAsync(request);

            // Version 2 returns 402 with PAYMENT-REQUIRED header
            Assert.That(resp.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.PaymentRequired));
            Assert.That(resp.Headers.Contains("PAYMENT-REQUIRED"), Is.True);
        }

        [Test]
        public async Task Version2_PAYMENTSIGNATURE_Priority_Over_XPayment()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xdead", Network = req.Network })
            };
            var reqs = CreateRequirements("/v2-priority");
            using var host = BuildHost(facilitator, "/v2-priority", reqs, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/v2-priority");
            // Send header
            request.Headers.Add(X402HandlerV2.PaymentHeaderV2, CreateHeaderB64(reqs, resource: "/v2-priority", from: "0xabc"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(resp.Headers.Contains("PAYMENT-RESPONSE"), Is.True);
        }

        [Test]
        public async Task MultiplePaymentRequirements_SelectsCorrectRequirement()
        {
            string? settledPayTo = null;
            string? settledAmount = null;

            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) =>
                {
                    settledPayTo = req.PayTo;
                    settledAmount = req.Amount;
                    return Task.FromResult(new SettlementResponse { Success = true, Transaction = "0x123", Network = req.Network });
                }
            };

            // Create multiple payment requirements with different PayTo addresses and amounts
            var requirements = new List<PaymentRequirements>
            {
                CreateRequirements("/multi", "0x1111111111111111111111111111111111111111", "5"),
                CreateRequirements("/multi", "0x2222222222222222222222222222222222222222", "10"),
                CreateRequirements("/multi", "0x3333333333333333333333333333333333333333", "15")
            };

            using var host = BuildHost(facilitator, "/multi", new ResourceInfo(), requirements, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/multi");
            // Send payment header targeting the second requirement (0x2222... with amount 10)
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(requirements[1], resource: "/multi", from: "0xabc", to: "0x2222222222222222222222222222222222222222", value: "10"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.IsSuccessStatusCode, Is.True);
            Assert.That(resp.Headers.Contains("PAYMENT-RESPONSE"), Is.True);
            // Verify the correct requirement was selected and settled
            Assert.That(settledPayTo, Is.EqualTo("0x2222222222222222222222222222222222222222"));
            Assert.That(settledAmount, Is.EqualTo("10"));
        }

        [Test]
        public async Task MultiplePaymentRequirements_NoMatch_Returns402()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0x123", Network = req.Network })
            };

            // Create multiple payment requirements
            var requirements = new List<PaymentRequirements>
            {
                CreateRequirements("/multi-fail", "0x1111111111111111111111111111111111111111", "5"),
                CreateRequirements("/multi-fail", "0x2222222222222222222222222222222222222222", "10"),
                CreateRequirements("/multi-fail", "0x3333333333333333333333333333333333333333", "15")
            };

            using var host = BuildHost(facilitator, "/multi-fail", new ResourceInfo(), requirements, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/multi-fail");
            // Send payment header that doesn't match any requirement (wrong PayTo)
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(requirements[0], resource: "/multi-fail", from: "0xabc", to: "0x9999999999999999999999999999999999999999", value: "5"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.PaymentRequired));
            Assert.That(resp.Headers.Contains("PAYMENT-REQUIRED"), Is.True);
        }

        [Test]
        public async Task MultiplePaymentRequirements_NonExistingAccepted_Returns402()
        {
            var facilitator = new FakeFacilitatorClient
            {
                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0x123", Network = req.Network })
            };

            // Create multiple payment requirements
            var requirements = new List<PaymentRequirements>
            {
                CreateRequirements("/multi", "0x1111111111111111111111111111111111111111", "5"),
                CreateRequirements("/multi", "0x3333333333333333333333333333333333333333", "15")
            };

            using var host = BuildHost(facilitator, "/multi", new ResourceInfo(), requirements, SettlementMode.Optimistic, onSettlement: null, onStartingMarker: null);
            var client = host.GetTestClient();
            var request = new HttpRequestMessage(HttpMethod.Get, "/multi");
            // Send payment header targeting the second requirement (0x2222... with amount 10)
            // The accepted one does not exist initially
            var other = CreateRequirements("/multi", "0x2222222222222222222222222222222222222222", "10");
            request.Headers.Add("PAYMENT-SIGNATURE", CreateHeaderB64(other, resource: "/multi", from: "0xabc", to: "0x2222222222222222222222222222222222222222", value: "10"));

            var resp = await client.SendAsync(request);

            Assert.That(resp.StatusCode, Is.EqualTo(System.Net.HttpStatusCode.PaymentRequired));
            Assert.That(resp.Headers.Contains("PAYMENT-REQUIRED"), Is.True);
        }

        [Test]
        public async Task HandleX402Async_UsesNetworkFromPaymentRequirementsBasic_WhenProvided()
        {
            // Arrange
            var paymentRequiredInfo = new PaymentRequiredInfo
            {
                Accepts =
                [
                    new PaymentRequirementsBasic
                    {
                        Scheme = PaymentScheme.Exact,
                        Asset = "test-asset",
                        Amount = "100",
                        PayTo = "test-payto",
                        Network = "provided-network"
                    }
                ],
                Resource = new ResourceInfoBasic { Description = "test resource", MimeType = "text/plain" }
            };

            _assetInfoProviderMock.Setup(x => x.GetAssetInfo(It.IsAny<string>()))
                            .Returns(new AssetInfo { Network = "asset-network", ContractAddress = "test-asset", Name = "Test Asset", Version = "1.0" });

            // Act
            var result = await _handler.HandleX402Async(paymentRequiredInfo);

            // Assert
            Assert.That(result, Is.Not.Null);
            Assert.That(result.PaymentRequirements.Count, Is.EqualTo(1));
            Assert.That(result.PaymentRequirements[0].Network, Is.EqualTo("provided-network"));
        }

        [Test]
        public async Task HandleX402Async_UsesNetworkFromAssetInfo_WhenNotProvidedInBasic()
        {
            // Arrange
            var paymentRequiredInfo = new PaymentRequiredInfo
            {
                Accepts =
                 [
                    new PaymentRequirementsBasic
                    {
                        Scheme = PaymentScheme.Exact,
                        Asset = "test-asset",
                        Amount = "100",
                        PayTo = "test-payto",
                        Network = null // Not provided
                    }
                              ],
                Resource = new ResourceInfoBasic { Description = "test resource", MimeType = "text/plain" }
            };

            _assetInfoProviderMock.Setup(x => x.GetAssetInfo("test-asset"))
                            .Returns(new AssetInfo { Network = "asset-network", ContractAddress = "test-asset", Name = "Test Asset", Version = "1.0" });

            // Act
            var result = await _handler.HandleX402Async(paymentRequiredInfo);

            // Assert
            Assert.That(result, Is.Not.Null);
            Assert.That(result.PaymentRequirements.Count, Is.EqualTo(1));
            Assert.That(result.PaymentRequirements[0].Network, Is.EqualTo("asset-network"));
        }
    }
}