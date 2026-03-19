using System.Text;
using System.Text.Json;

namespace x402.Core.Models.v2
{
    /// <summary>
    /// Payload extracted from the PAYMENT header.
    /// </summary>
    public class PaymentPayloadHeader
    {
        /// <summary>
        /// The X402 version.
        /// </summary>
        public int X402Version { get; set; }

        /// <summary>
        /// The parsed payload
        /// </summary>
        public required Payload Payload { get; set; }

        /// <summary>
        /// The payment required payload fulfills
        /// </summary>
        public required PaymentRequirements Accepted { get; set; }

        public Dictionary<string, ExtensionData>? Extensions { get; set; }


        /// <summary>
        /// Parses the payment payload from the base64-encoded header.
        /// </summary>
        /// <param name="header">The PAYMENT header value.</param>
        /// <returns>The parsed PaymentPayload.</returns>
        /// <exception cref="ArgumentException">If the header is malformed.</exception>
        public static PaymentPayloadHeader FromHeader(string header)
        {
            try
            {
                byte[] decodedBytes = Convert.FromBase64String(header);
                string jsonString = System.Text.Encoding.UTF8.GetString(decodedBytes);

                JsonSerializerOptions jsonOptions = new(JsonSerializerDefaults.Web);
                var payload = JsonSerializer.Deserialize<PaymentPayloadHeader>(jsonString, jsonOptions);
                if (payload == null)
                {
                    throw new ArgumentException("Invalid JSON in header");
                }
                return payload;
            }
            catch (Exception ex)
            {
                throw new ArgumentException("Malformed PAYMENT header", ex);
            }
        }

        public string ToBase64Header()
        {
            JsonSerializerOptions headerJsonOptions = new(JsonSerializerDefaults.Web)
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            };


            var headerJson = JsonSerializer.Serialize(this, headerJsonOptions);
            var base64header = Convert.ToBase64String(Encoding.UTF8.GetBytes(headerJson));

            return base64header;

        }

        /// <summary>
        /// Extract the payer wallet address from payment payload.
        /// </summary>
        public string? ExtractPayerFromPayload()
        {
            return Payload?.Authorization?.From;
        }
    }

    public class Payload
    {
        /// <summary>
        /// EIP-712 signature for authorization
        /// </summary>
        public string Signature { get; set; } = string.Empty;

        /// <summary>
        /// EIP-3009 authorization parameter
        /// </summary>
        public required Authorization Authorization { get; set; }
    }

    public class Authorization
    {
        /// <summary>
        /// Payer's wallet address
        /// </summary>
        public string From { get; set; } = string.Empty;

        /// <summary>
        /// 	Recipient's wallet address
        /// </summary>
        public string To { get; set; } = string.Empty;

        /// <summary>
        /// Payment amount in atomic units
        /// </summary>
        public string Value { get; set; } = string.Empty;

        /// <summary>
        /// Unix timestamp when authorization becomes valid
        /// </summary>
        public string ValidAfter { get; set; } = string.Empty;

        /// <summary>
        /// Unix timestamp when authorization expires
        /// </summary>
        public string ValidBefore { get; set; } = string.Empty;

        /// <summary>
        /// 32-byte random nonce to prevent replay attacks
        /// </summary>
        public string Nonce { get; set; } = string.Empty;
    }
}
