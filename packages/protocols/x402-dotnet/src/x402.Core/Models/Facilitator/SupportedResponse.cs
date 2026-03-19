namespace x402.Core.Models.Facilitator
{
    /// <summary>
    /// Response from supported operation.
    /// </summary>
    public class SupportedResponse
    {
        public List<FacilitatorKind> Kinds { get; set; } = new();
        public List<string>? Extensions { get; set; }

        public Dictionary<string, List<string>>? Signers { get; set; }

    }

}
