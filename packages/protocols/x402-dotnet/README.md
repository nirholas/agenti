# x402-dotnet

![x402 payments enabled](https://github.com/michielpost/x402-dotnet/raw/master/images/x402-button-small.png)  
**x402 Payment Protocol implementation for .Net**  

Starting with version 2.0.0, this library targets x402 **v2**.  
All 0.x versions target x402 v1.


### x402 on the server
Install the `x402` packages from NuGet:
- [x402](https://nuget.org/packages/x402)
- [x402.Coinbase](https://nuget.org/packages/x402) to use the Coinbase facilitator

**Features:**
- Add an x402-compatible paywall to any URL  
- Easily use an attribute to handle payments for your API methods  
- Add URLs that require payment using the middleware  
- Support advanced scenarios by calling the `X402Handler` in your API controller  
- Handle payment settlement using any remote facilitator  
- Optionally use the Coinbase facilitator (with API key)
- Extensible AssetInfoProvider that fills in network and coin data based on the asset address


### x402 enabled HttpClient
Install the `x402.Client.EVM` package from NuGet:
- [x402.Client.EVM](https://nuget.org/packages/x402.Client.EVM)

**Features:**
- Transparant access x402-protected resources
- Fully HttpClient compatible
- Pay using the embedded EVM compatible wallet (Ethereum / Base)
- Set allowances per request or globally
- X402.Client.ConsoleSample sample application included
- Blazor Sample project available

## How to use?

Register the x402 services and facilitator in `Program.cs`:
```cs
// Use the default HttpFacilitator
builder.Services.AddX402().WithHttpFacilitator(facilitatorUrl);
```

Use the `PaymentRequired` Attribute (easy to add to existing projects)
```cs
// Use the Payment Required Attribute
[HttpGet]
[Route("protected")]
[PaymentRequired("1000", "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "0xYourAddressHere")]
public SampleResult Protected()
{
    return new SampleResult { Title = "Protected by PaymentRequired Attribute" };
}

```
Directly in an API Controller (for more control)
```cs
public ResourceController(X402HandlerV2 x402Handler)
{
    this.x402Handler = x402Handler;
}

[HttpGet]
[Route("dynamic")]
public async Task<SampleResult?> Dynamic(string amount)
{
    var x402Result = await x402Handler.HandleX402Async(this.HttpContext,
        new PaymentRequiredInfo()
        {
            Resource = new ResourceInfoBasic
            {
                Description = "This resource is protected dynamically",
            },
            Accepts = new List<PaymentRequirementsBasic>
            {
                new PaymentRequirementsBasic
                {
                    Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    Amount = amount,
                    PayTo = "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37",
                }
            }
        },);

    if (!x402Result.CanContinueRequest)
    {
        return null; // Response already written by HandleX402Async, so just exit
    }

    //Continue with the request
}
```


Or use the `PaymentMiddleware` to require payment for a list of URLs
```cs
// Add Middleware
var paymentOptions = new PaymentMiddlewareOptions
{
    PaymentRequirements = new Dictionary<string, PaymentRequirementsConfig>()
    {
        {  "/resource/middleware", new PaymentRequirementsConfig
            {
                Version = 2,
                PaymentRequirements = new PaymentRequiredInfo
                {
                    Resource = new ResourceInfoBasic
                    {
                         MimeType = "application/json",
                        Description = "Payment Required",
                    },
                    Accepts = new()
                    {
                        new PaymentRequirementsBasic {
                            Amount = "1000",
                            Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                            PayTo = "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37", // Replace with your actual wallet address
                        }
                    },
                    Discoverable = true,
                }
            }
        }
    },
};

app.UsePaymentMiddleware(paymentOptions);

```

## Coinbase Facilitator
To use the Coinbase Facilitator, install [x402.Coinbase](https://nuget.org/packages/x402.Coinbase)

```cs
// Add the Coinbase Config and Facilitator
builder.Services.AddX402().WithCoinbaseFacilitator(builder.Configuration);
```

Add to appsettings.json:
```json
 "CoinbaseOptions": {
   "ApiKeyId": "YOUR_COINBASE_API_KEY_ID",
   "ApiKeySecret": "YOUR_COINBASE_API_KEY_SECRET"
 }
```

## x402 HttpClient

```cs
// Fixed private key (32 bytes hex)
var wallet = new EVMWallet("0x0123454242abcdef0123456789abcdef0123456789abcdef0123456789abcdef", chainId) //84532UL = base-sepolia
{
    IgnoreAllowances = true
};

var handler = new PaymentRequiredV2Handler(new WalletProvider(wallet));

var client = new HttpClient(handler);
var response = await client.GetAsync("https://www.x402.org/protected");

Console.WriteLine($"Final: {(int)response.StatusCode} {response.ReasonPhrase}");
```

See `X402.Client.ConsoleSample` for a complete example.

## x402-dotnet Facilitator
Explore the `x402.FacilitatorWeb` project for a dotnet based facilitator for EVM and Solana networks.


## How to test?
Follow these steps to test a x402 payment on the sample website hosted on Azure:
- Get some `USDC` tokens on the `base-sepolia` network from the [Coinbase Faucet](https://faucet.circle.com/)
- Use the x402 Debug Tool: https://proxy402.com/fetch
- Enter an API endpoint from the [test website](https://x402-dotnet.azurewebsites.net/), for example: `https://x402-dotnet.azurewebsites.net/resource/middleware`
- Connect your wallet
- Click Pay
- Payment will complete and show the result: `Protected by middleware`



## Public Facilitators
List of facilitators you can use:
- https://api.cdp.coinbase.com/platform/v2/x402/ (Coinbase, requires API key)
- https://facilitator.payai.network
- https://facilitator.mogami.tech/
- https://facilitator.daydreams.systems

View more facilitators and their status on https://www.x402dev.com


## Development
There is a sample website and mock Settlement server included.  
- Start the Aspire project: `x402-dotnet.AppHost`
- Navigate to the sample website `https://localhost:7154/`
- Use `x402.SampleWeb.http` for sample web requests

## Contributions
Contributions are welcome. Fork this repository and send a pull request if you have something useful to add.


## Links
Useful tools when developing x402 solutions:
- More info about x402: https://www.x402.org
- Dev tools https://x402dev.com
- Test tool https://proxy402.com/fetch
- Specifications: https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md

