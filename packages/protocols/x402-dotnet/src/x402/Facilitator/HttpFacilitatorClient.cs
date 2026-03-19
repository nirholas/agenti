using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace x402.Facilitator
{
    public partial class HttpFacilitatorClient
    {
        private readonly HttpClient httpClient;
        private readonly ILogger<HttpFacilitatorClient> logger;
        protected static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            WriteIndented = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        /// <summary>
        /// Creates a new HTTP facilitator client.
        /// </summary>
        /// <param name="baseUrl">The base URL of the facilitator service (trailing slash will be removed)</param>
        public HttpFacilitatorClient(HttpClient httpClient, ILogger<HttpFacilitatorClient> logger)
        {
            this.httpClient = httpClient;
            this.logger = logger;
        }

        /// <summary>
        /// Allows derived clients to adjust the URL for a given relative path and HTTP method.
        /// Default behavior is to return the relative path unchanged (uses HttpClient.BaseAddress).
        /// </summary>
        /// <param name="relativePath">A path like "/verify" or "/settle".</param>
        /// <param name="method">HTTP method for the request.</param>
        /// <returns>URL or relative path to pass to HttpRequestMessage.</returns>
        protected virtual string BuildUrl(string relativePath, HttpMethod method) => relativePath;

        /// <summary>
        /// Allows derived clients to modify the outgoing request (e.g., add headers).
        /// Default behavior is no-op.
        /// </summary>
        /// <param name="request">The request to be sent.</param>
        protected virtual void PrepareRequest(HttpRequestMessage request) { }
    }
}
