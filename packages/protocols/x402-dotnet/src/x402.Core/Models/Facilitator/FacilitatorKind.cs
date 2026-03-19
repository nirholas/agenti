using System.Text.Json.Serialization;

namespace x402.Core.Models.Facilitator
{
    public record FacilitatorKind(
     [property: JsonPropertyName("scheme")] string Scheme,
     [property: JsonPropertyName("network")] string Network,
     [property: JsonPropertyName("x402Version")] int X402Version,
     [property: JsonPropertyName("extra")] FacilitatorKindExtra? Extra = null
         )
    {
        public override string ToString() => $"{Scheme}:{Network}";
    }

    public record FacilitatorKindExtra(
     [property: JsonPropertyName("feePayer")] string FeePayer
         );


}
