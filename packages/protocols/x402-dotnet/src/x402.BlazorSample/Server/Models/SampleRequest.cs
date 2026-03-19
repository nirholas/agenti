using System.ComponentModel.DataAnnotations;

namespace x402.BlazorSample.Server.Models
{
    public class SampleRequest
    {
        [Required]
        public required string Value { get; set; }
    }
}
