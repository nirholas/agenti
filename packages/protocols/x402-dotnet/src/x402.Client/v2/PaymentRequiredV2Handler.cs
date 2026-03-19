using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text;
using System.Text.Json;
using x402.Client.Events;
using x402.Core.Models.v2;

namespace x402.Client.v2;

public class PaymentRequiredV2Handler : DelegatingHandler
{
    private readonly IWalletProvider _walletProvider;
    private readonly ILogger<PaymentRequiredV2Handler> _logger;
    private readonly int _maxRetries;

    public const string PaymentRequiredHeader = "PAYMENT-REQUIRED";

    public PaymentRequiredV2Handler(IWalletProvider walletProvider, ILogger<PaymentRequiredV2Handler> logger, int maxRetries = 1)
    {
        _walletProvider = walletProvider ?? throw new ArgumentNullException(nameof(walletProvider));
        _logger = logger;
        _maxRetries = maxRetries;
    }

    public static PaymentRequiredV2Handler Create(IWalletProvider walletProvider, HttpMessageHandler? innerHandler = null, int maxRetries = 1, ILogger<PaymentRequiredV2Handler>? logger = null) => new(walletProvider, logger ?? new NullLogger<PaymentRequiredV2Handler>(), innerHandler ?? new HttpClientHandler(), maxRetries);

    // Manual chaining constructor, private so it's not called by WebAssembly
    private PaymentRequiredV2Handler(IWalletProvider walletProvider, ILogger<PaymentRequiredV2Handler> logger, HttpMessageHandler innerHandler, int maxRetries = 1)
        : base(innerHandler)
    {
        _walletProvider = walletProvider ?? throw new ArgumentNullException(nameof(walletProvider));
        _logger = logger;
        _maxRetries = maxRetries;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken = default)
    {
        var retries = 0;
        var response = await base.SendAsync(request, cancellationToken);

        _logger.LogInformation("Received response with status code {StatusCode} for request to {RequestUri}", response.StatusCode, request.RequestUri);

        while (response.StatusCode == System.Net.HttpStatusCode.PaymentRequired &&
               retries < _maxRetries)
        {
            _logger.LogInformation("Processing Payment Required response for request to {RequestUri}", request.RequestUri);

            // Get payment required details from response body
            var paymentRequiredResponse = await ParsePaymentRequiredResponseAsync(response);
            if (paymentRequiredResponse == null)
            {
                _logger.LogWarning("Failed to parse Payment Required response for request to {RequestUri}", request.RequestUri);
                break;
            }

            // Notify subscribers
            var canContinue = await _walletProvider.RaisePrepareWallet(new PrepareWalletEventArgs<PaymentRequiredResponse>(request, response, paymentRequiredResponse));

            if (_walletProvider.Wallet == null)
            {
                _logger.LogWarning("No wallet available to process Payment Required response for request to {RequestUri}", request.RequestUri);
                return response;
            }

            if (!canContinue || paymentRequiredResponse.Accepts.Count == 0)
            {
                _logger.LogInformation("No payment requirements accepted or processing cancelled for request to {RequestUri}. CanContinue: {canContinue}, Accepts Count: {count}", request.RequestUri, canContinue, paymentRequiredResponse.Accepts.Count);
                break;
            }

            var selectedRequirement = await _walletProvider.Wallet.SelectPaymentAsync(paymentRequiredResponse, cancellationToken);

            // Notify subscribers
            _walletProvider.RaiseOnPaymentSelected(new PaymentSelectedEventArgs<PaymentRequirements>(request, selectedRequirement));

            if (selectedRequirement == null)
            {
                _logger.LogInformation("No payment requirement selected for request to {RequestUri}", request.RequestUri);
                break;
            }

            var header = await _walletProvider.Wallet.CreateHeaderAsync(selectedRequirement, cancellationToken);
            retries++;
            _walletProvider.RaiseOnHeaderCreated(new HeaderCreatedEventArgs<PaymentPayloadHeader>(header, retries));

            _logger.LogInformation("Retrying request to {RequestUri} with payment header", request.RequestUri);

            var retryRequest = await CloneHttpRequestAsync(request);
            retryRequest.AddPaymentHeader(header);

            response.Dispose();


            response = await base.SendAsync(retryRequest, cancellationToken);

            _logger.LogInformation("Received response with status code {StatusCode} for retried request to {RequestUri}", response.StatusCode, request.RequestUri);

        }

        return response;
    }

    private static async Task<PaymentRequiredResponse?> ParsePaymentRequiredResponseAsync(HttpResponseMessage response)
    {
        try
        {
            // Version 2: Try to parse from PAYMENT-REQUIRED header
            if (response.Headers.TryGetValues(PaymentRequiredHeader, out var headerValues))
            {
                var headerValue = headerValues.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(headerValue))
                {
                    try
                    {
                        var decodedBytes = Convert.FromBase64String(headerValue);
                        var jsonString = Encoding.UTF8.GetString(decodedBytes);
                        var parsed = JsonSerializer.Deserialize<PaymentRequiredResponse>(jsonString,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (parsed != null && parsed.X402Version == 2)
                        {
                            return parsed;
                        }
                    }
                    catch
                    {
                        // Fall through to try body parsing
                    }
                }
            }

        }
        catch
        {
        }

        return null;
    }

    private static async Task<HttpRequestMessage> CloneHttpRequestAsync(HttpRequestMessage request)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri)
        {
            Version = request.Version,
            Content = request.Content == null ? null : new StreamContent(await request.Content.ReadAsStreamAsync())
        };

        foreach (var header in request.Headers)
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);

        if (request.Content != null)
        {
            foreach (var header in request.Content.Headers)
                clone.Content?.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        return clone;
    }
}
