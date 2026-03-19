using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Nethereum.Blazor;
using Nethereum.Metamask;
using Nethereum.Metamask.Blazor;
using Nethereum.UI;
using x402.BlazorSample.Client;
using x402.Client.v2;
using x402.Core;
using x402.Core.Interfaces;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddSingleton<IWalletProvider, WalletProvider>();
builder.Services.AddTransient<PaymentRequiredV2Handler>();

//builder.Services.AddScoped(sp =>
//{
//    var handler = sp.GetRequiredService<PaymentRequiredV1Handler>();
//    var client = new HttpClient(handler)
//    {
//        BaseAddress = new Uri(builder.HostEnvironment.BaseAddress)
//    };
//    return client;
//});

builder.Services.AddHttpClient("x402", client =>
{
    client.BaseAddress = new Uri(builder.HostEnvironment.BaseAddress);
})
.AddHttpMessageHandler<PaymentRequiredV2Handler>();

builder.Services.AddSingleton<IAssetInfoProvider, AssetInfoProvider>();


builder.Services.AddAuthorizationCore();
builder.Services.AddSingleton<IMetamaskInterop, MetamaskBlazorInterop>();
builder.Services.AddSingleton<MetamaskHostProvider>();

//Add metamask as the selected ethereum host provider
builder.Services.AddSingleton(services =>
{
    var metamaskHostProvider = services.GetService<MetamaskHostProvider>();
    var selectedHostProvider = new SelectedEthereumHostProviderService();
    selectedHostProvider.SetSelectedEthereumHostProvider(metamaskHostProvider);
    return selectedHostProvider;
});


builder.Services.AddSingleton<AuthenticationStateProvider, EthereumAuthenticationStateProvider>();

await builder.Build().RunAsync();
