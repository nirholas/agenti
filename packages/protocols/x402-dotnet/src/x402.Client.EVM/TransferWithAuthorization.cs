using Nethereum.ABI.FunctionEncoding.Attributes;
using Newtonsoft.Json;
using System.Numerics;

namespace x402.Client.EVM
{
    [Struct("TransferWithAuthorization")]
    public class TransferWithAuthorization
    {
        [Parameter("address", "from", order: 1)]
        [JsonProperty("from")]
        public virtual required string From { get; set; }

        [Parameter("address", "to", order: 2)]
        [JsonProperty("to")]
        public virtual required string To { get; set; }

        [Parameter("uint256", "value", order: 3)]
        [JsonProperty("value")]
        public virtual BigInteger Value { get; set; }

        [Parameter("uint256", "validAfter", order: 4)]
        [JsonProperty("validAfter")]
        public virtual BigInteger ValidAfter { get; set; }

        [Parameter("uint256", "validBefore", order: 5)]
        [JsonProperty("validBefore")]
        public virtual BigInteger ValidBefore { get; set; }

        [Parameter("bytes32", "nonce", order: 6)]
        [JsonProperty("nonce")]
        public virtual byte[]? Nonce { get; set; }
    }
}
