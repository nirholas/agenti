using System.ComponentModel.DataAnnotations;

namespace x402.SampleWeb.Models
{
    public class SampleRequest
    {
        [Required]
        public required string Value { get; set; }
    }
}
