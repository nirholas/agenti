using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;
using x402.Core.Models.v2.Facilitator;

namespace x402.Facilitator
{
    public partial class HttpFacilitatorClient : IFacilitatorV2Client
    {
        public async Task<VerificationResponse> VerifyAsync(PaymentPayloadHeader paymentPayload, PaymentRequirements req, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("Verifying payment payload for resource with scheme {Scheme} and asset {Asset}", req.Scheme, req.Asset);
            var body = new FacilitatorRequest
            {
                X402Version = paymentPayload.X402Version,
                PaymentPayload = paymentPayload,
                PaymentRequirements = req
            };

            var url = BuildUrl("verify", HttpMethod.Post);
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent.Create(body, options: JsonOptions)
            };
            PrepareRequest(request);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(req.MaxTimeoutSeconds));

            var response = await httpClient.SendAsync(request, cts.Token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                logger.LogWarning("Verification request failed with status {StatusCode}: {Content}", (int)response.StatusCode, content);
                throw new HttpRequestException($"HTTP {(int)response.StatusCode}: {content}");
            }

            var result = await response.Content.ReadFromJsonAsync<VerificationResponse>(JsonOptions, cancellationToken).ConfigureAwait(false);
            if (result is null)
            {
                logger.LogError("Failed to deserialize verification response");
                throw new InvalidOperationException("Failed to deserialize verification response");
            }
            logger.LogInformation("Verification result: IsValid={IsValid} Reason={Reason}", result.IsValid, result.InvalidReason);
            return result;
        }

        public async Task<SettlementResponse> SettleAsync(PaymentPayloadHeader paymentPayload, PaymentRequirements req, CancellationToken cancellationToken = default)
        {
            logger.LogInformation("Settling payment on network {Network} to {PayTo}", req.Network, req.PayTo);
            var body = new FacilitatorRequest
            {
                X402Version = paymentPayload.X402Version,
                PaymentPayload = paymentPayload,
                PaymentRequirements = req
            };

            var url = BuildUrl("settle", HttpMethod.Post);
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent.Create(body, options: JsonOptions)
            };
            PrepareRequest(request);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(req.MaxTimeoutSeconds));

            var response = await httpClient.SendAsync(request, cts.Token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                logger.LogWarning("Settlement request failed with status {StatusCode}: {Content}", (int)response.StatusCode, content);
                throw new HttpRequestException($"HTTP {(int)response.StatusCode}: {content}");
            }

            var result = await response.Content.ReadFromJsonAsync<SettlementResponse>(JsonOptions, cancellationToken).ConfigureAwait(false);
            if (result is null)
            {
                logger.LogError("Failed to deserialize settlement response");
                throw new InvalidOperationException("Failed to deserialize settlement response");
            }
            logger.LogInformation("Settlement result: Success={Success} Tx={Tx}", result.Success, result.Transaction);
            return result;

        }

        public async Task<SupportedResponse> SupportedAsync(CancellationToken cancellationToken = default)
        {
            logger.LogDebug("Requesting supported facilitator kinds");
            var url = BuildUrl("supported", HttpMethod.Get);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            PrepareRequest(request);

            using var response = await httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                logger.LogWarning("Supported kinds request failed with status {StatusCode}: {Content}", (int)response.StatusCode, content);
                throw new HttpRequestException($"HTTP {(int)response.StatusCode}: {content}");
            }

            var result = await response.Content.ReadFromJsonAsync<SupportedResponse>(JsonOptions, cancellationToken).ConfigureAwait(false);

            return result ?? new();
        }

        public async Task<DiscoveryResponse> DiscoveryAsync(string? type = null, int? limit = null, int? offset = null, CancellationToken cancellationToken = default)
        {
            logger.LogDebug("Requesting discovery resource list");

            var baseUrl = "discovery/resources";
            var queryParams = new List<string>();

            if (!string.IsNullOrEmpty(type))
                queryParams.Add($"type={Uri.EscapeDataString(type)}");

            if (limit.HasValue)
                queryParams.Add($"limit={limit.Value}");

            if (offset.HasValue)
                queryParams.Add($"offset={offset.Value}");

            var discoveryUrl = queryParams.Count > 0
                ? $"{baseUrl}?{string.Join("&", queryParams)}"
                : baseUrl;

            var url = BuildUrl(discoveryUrl, HttpMethod.Get);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            PrepareRequest(request);

            using var response = await httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                logger.LogWarning("Discover resources request failed with status {StatusCode}: {Content}", (int)response.StatusCode, content);
                throw new HttpRequestException($"HTTP {(int)response.StatusCode}: {content}");
            }

            var result = await response.Content.ReadFromJsonAsync<DiscoveryResponse>(JsonOptions, cancellationToken).ConfigureAwait(false);

            return result ?? new();
        }
    }
}
