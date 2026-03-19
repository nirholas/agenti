using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using x402.Coinbase.Models;
using x402.Facilitator;

namespace x402.Coinbase
{
    public static class ServiceCollectionExtension
    {
        public static IServiceCollection WithCoinbaseFacilitator(this IServiceCollection services, ConfigurationManager configuration)
        {
            // Coinbase facilitator client
            services.Configure<CoinbaseOptions>(configuration.GetSection(nameof(CoinbaseOptions)));
            services.AddHttpClient<IFacilitatorV2Client, CoinbaseFacilitatorClient>();

            return services;
        }
    }
}
