using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using x402.Attributes;
using x402.Core;
using x402.Core.Enums;
using x402.Core.Interfaces;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;
using x402.Facilitator;

namespace x402.Tests
{
    [TestFixture]
    public class PaymentRequiredAttributeTests
    {

        private static ActionExecutingContext CreateActionExecutingContext(IServiceProvider services, string path = "/pay")
        {
            var httpContext = new DefaultHttpContext();
            httpContext.RequestServices = services;
            httpContext.Request.Path = path;

            var accessor = services.GetService<IHttpContextAccessor>();
            if (accessor != null)
            {
                accessor.HttpContext = httpContext;
            }

            var routeData = new RouteData();
            var actionContext = new ActionContext(httpContext, routeData, new ControllerActionDescriptor());
            var filters = new List<IFilterMetadata>();
            var actionArguments = new Dictionary<string, object?>();
            return new ActionExecutingContext(actionContext, filters, actionArguments, controller: new object());
        }

        [Test]
        public async Task NoHeader_StopsExecution_Returns402()
        {
            bool nextCalled = false;

            var services = new ServiceCollection()
                .AddLogging(b => b.AddDebug().AddConsole().SetMinimumLevel(LogLevel.Debug))
                .AddSingleton<IFacilitatorV2Client, FakeFacilitatorClient>()
                .AddSingleton<X402HandlerV2>()
                .AddSingleton<IAssetInfoProvider, AssetInfoProvider>()
                .AddHttpContextAccessor()
                .BuildServiceProvider();

            var context = CreateActionExecutingContext(services, "/needs-pay");

            var attr = new PaymentRequiredAttribute(
                maxAmountRequired: "1",
                asset: "USDC",
                payTo: "0x0000000000000000000000000000000000000001",
                scheme: PaymentScheme.Exact)
            {
                Description = "unit test",
                MimeType = "application/json",
                SettlementMode = SettlementMode.Optimistic
            };

            await attr.OnActionExecutionAsync(context, () =>
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(context, new List<IFilterMetadata>(), controller: new object()));
            });

            Assert.That(nextCalled, Is.False);
            Assert.That(context.HttpContext.Response.StatusCode, Is.EqualTo(StatusCodes.Status402PaymentRequired));
        }

        [Test]
        public async Task ValidPayment_ContinuesExecution()
        {
            bool nextCalled = false;
            var fake = new FakeFacilitatorClient
            {

                VerifyAsyncImpl = (_, _) => Task.FromResult(new VerificationResponse { IsValid = true }),
                SettleAsyncImpl = (_, req) => Task.FromResult(new SettlementResponse { Success = true, Transaction = "0xdead", Network = req.Network })
            };

            var services = new ServiceCollection()
                .AddLogging(b => b.AddDebug().AddConsole().SetMinimumLevel(LogLevel.Debug))
                .AddSingleton<IFacilitatorV2Client>(fake)
                .AddSingleton<X402HandlerV2>()
                .AddSingleton<IAssetInfoProvider, AssetInfoProvider>()
                .AddHttpContextAccessor()
                .BuildServiceProvider();

            var context = CreateActionExecutingContext(services, "/ok");

            // Add a valid PAYMENT header with resource match
            var headerJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                x402Version = 2,
                accepted = new PaymentRequirements
                {
                    Amount = "1",
                    Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    Network = "eip155:84532",
                    PayTo = "0x0000000000000000000000000000000000000001",
                    Scheme = PaymentScheme.Exact,
                },
                payload = new Dictionary<string, object?>
                {
                    { "authorization", new Dictionary<string, object?> {
                        { "from", "0xabc" },
                        { "to", "0x0000000000000000000000000000000000000001" } ,
                        { "value", "1" },
                        { "validBefore", DateTimeOffset.UtcNow.AddSeconds(5).ToUnixTimeSeconds().ToString() },
                        { "validAfter", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString() }
                    } },
                    { "resource", ":///ok" }
                }
            }, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
            var headerB64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(headerJson));
            context.HttpContext.Request.Headers[X402HandlerV2.PaymentHeaderV2] = headerB64;

            var attr = new PaymentRequiredAttribute(
                maxAmountRequired: "1",
                asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                payTo: "0x0000000000000000000000000000000000000001",
                scheme: PaymentScheme.Exact)
            {
                Description = "unit test",
                MimeType = "application/json",
                SettlementMode = SettlementMode.Optimistic
            };

            await attr.OnActionExecutionAsync(context, () =>
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(context, new List<IFilterMetadata>(), controller: new object()));
            });

            Assert.That(nextCalled, Is.True);
            Assert.That(context.HttpContext.Response.HasStarted || context.HttpContext.Response.StatusCode == 0 || context.HttpContext.Response.StatusCode == StatusCodes.Status200OK, Is.True);
        }
    }
}


