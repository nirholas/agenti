using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using System.Text;
using System.Text.Json;

namespace x402.Coinbase
{
    public static class JWTHelper
    {
        public static string GenerateBearerJWT(string keyName,
            string keySecret,
            string requestMethod,
            string url
            )
        {
            var uri = new Uri(url);
            var requestHost = uri.Host;
            var requestPath = uri.PathAndQuery;

            // Decode the Ed25519 private key from base64
            byte[] decoded = Convert.FromBase64String(keySecret);

            // Ed25519 keys are 64 bytes (32 bytes seed + 32 bytes public key)
            if (decoded.Length != 64)
            {
                throw new Exception("Invalid Ed25519 key length");
            }

            // Extract the seed (first 32 bytes)
            byte[] seed = new byte[32];
            Array.Copy(decoded, 0, seed, 0, 32);

            // Create Ed25519 private key parameters
            var privateKey = new Ed25519PrivateKeyParameters(seed, 0);

            // Create the URI
            string uriFormat = $"{requestMethod} {requestHost}{requestPath}";

            // Create header
            var header = new Dictionary<string, object>
            {
                { "alg", "EdDSA" },
                { "typ", "JWT" },
                { "kid", keyName },
                { "nonce", GenerateNonce() }
            };

            // Create payload with timing
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var payload = new Dictionary<string, object>
            {
                { "sub", keyName },
                { "iss", "cdp" },
                { "aud", new[] { "cdp_service" } },
                { "nbf", now },
                { "exp", now + 120 }, // 2 minutes expiration
                { "uri", uriFormat }
            };

            // Encode header and payload
            string headerJson = JsonSerializer.Serialize(header);
            string payloadJson = JsonSerializer.Serialize(payload);

            string encodedHeader = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));
            string encodedPayload = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

            string message = $"{encodedHeader}.{encodedPayload}";

            // Sign with Ed25519
            var signer = new Ed25519Signer();
            signer.Init(true, privateKey);
            byte[] messageBytes = Encoding.UTF8.GetBytes(message);
            signer.BlockUpdate(messageBytes, 0, messageBytes.Length);
            byte[] signature = signer.GenerateSignature();

            string encodedSignature = Base64UrlEncode(signature);

            return $"{message}.{encodedSignature}";
        }

        // Method to generate a dynamic nonce
        static string GenerateNonce()
        {
            var random = new Random();
            var nonce = new char[16];
            for (int i = 0; i < 16; i++)
            {
                nonce[i] = (char)('0' + random.Next(10));
            }
            return new string(nonce);
        }

        // Base64 URL encoding without padding
        static string Base64UrlEncode(byte[] input)
        {
            return Convert.ToBase64String(input)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");
        }
    }
}