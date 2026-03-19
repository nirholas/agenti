using Nethereum.Web3;
using Nethereum.Web3.Accounts;
using Solnet.Rpc;
using x402.Core.Models.Facilitator;
using x402.Facilitator;
using x402.Facilitator.EVM;
using x402.Facilitator.Solana;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Add services to the container.

// Solana setup
var rpcClient = Solnet.Rpc.ClientFactory.GetClient("https://api.mainnet-beta.solana.com");
builder.Services.AddSingleton<IRpcClient>(rpcClient);

//TODO: Load from Config
var facilitatorPrivateKey = new byte[64];
var facilitatorSigner = new Solnet.Wallet.Wallet(facilitatorPrivateKey);
builder.Services.AddSingleton<Solnet.Wallet.Wallet>(facilitatorSigner);


// Register the SolanaPaymentService
builder.Services.AddScoped<SolanaPaymentService>();

// EVM setup
var evmRpcUrl = builder.Configuration["EvmRpcUrl"] ?? "https://sepolia.base.org"; // Base Sepolia as default
var evmPrivateKey = builder.Configuration["EvmPrivateKey"] ?? "0x0000000000000000000000000000000000000000000000000000000000000001"; // Placeholder

var account = new Account(evmPrivateKey);
var web3 = new Web3(account, evmRpcUrl);

builder.Services.AddSingleton<IWeb3>(web3);
builder.Services.AddSingleton(sp => account.Address); // Facilitator address

// Register the EvmPaymentService
builder.Services.AddScoped(sp =>
{
    var web3Service = sp.GetRequiredService<IWeb3>();
    var facilitatorAddress = sp.GetRequiredService<string>();
    return new EvmPaymentService(web3Service, facilitatorAddress);
});

// Register PaymentServiceFactory and configure supported networks
builder.Services.AddSingleton<PaymentServiceFactory>(sp =>
{
    var factory = new PaymentServiceFactory();

    // Register Solana networks
    var solanaKind = new FacilitatorKind("exact", "solana", 1);
    var solanaDevnetKind = new FacilitatorKind("exact", "solana-devnet", 1);

    factory.Register(solanaKind, () => sp.GetRequiredService<SolanaPaymentService>());
    factory.Register(solanaDevnetKind, () => sp.GetRequiredService<SolanaPaymentService>());

    // Register EVM networks
    var baseSepoliaKind = new FacilitatorKind("exact", "eip155:84532", 1);
    var baseKind = new FacilitatorKind("exact", "eip155:8453", 1);
    var avalancheFujiKind = new FacilitatorKind("exact", "avalanche-fuji", 1);
    var avalancheKind = new FacilitatorKind("exact", "avalanche", 1);
    var polygonKind = new FacilitatorKind("exact", "polygon", 1);
    var polygonAmoyKind = new FacilitatorKind("exact", "polygon-amoy", 1);

    factory.Register(baseSepoliaKind, () => sp.GetRequiredService<EvmPaymentService>());
    factory.Register(baseKind, () => sp.GetRequiredService<EvmPaymentService>());
    factory.Register(avalancheFujiKind, () => sp.GetRequiredService<EvmPaymentService>());
    factory.Register(avalancheKind, () => sp.GetRequiredService<EvmPaymentService>());
    factory.Register(polygonKind, () => sp.GetRequiredService<EvmPaymentService>());
    factory.Register(polygonAmoyKind, () => sp.GetRequiredService<EvmPaymentService>());

    return factory;
});

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "x402-dotnet Facilitator", Version = "v1" });
});

var app = builder.Build();

app.MapDefaultEndpoints();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "x402-dotnet Facilitator");
});
app.Run();
