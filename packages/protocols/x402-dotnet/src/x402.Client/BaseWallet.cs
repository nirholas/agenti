using x402.Client.Models;
using x402.Client.v2;

namespace x402.Client
{
    public abstract class BaseWallet : IX402WalletV2
    {
        public List<AssetAllowance> AssetAllowances { get; set; } = new();
        public bool IgnoreAllowances { get; set; }
        public string Network { get; set; }

        protected BaseWallet(string network)
        {
            Network = network;
        }

        #region v2
        public virtual async Task<Core.Models.v2.PaymentRequirements?> SelectPaymentAsync(Core.Models.v2.PaymentRequiredResponse paymentRequiredResponse, CancellationToken cancellationToken = default)
        {
            var allowedRequirements = paymentRequiredResponse.Accepts
                .Where(r => AssetAllowances.Any(a =>
                    a.Asset == r.Asset
                    && a.TotalAllowance >= long.Parse(r.Amount)
                    && a.MaxPerRequestAllowance >= long.Parse(r.Amount))
                || IgnoreAllowances)
                .Where(x => x.Network == this.Network)
                .ToList();

            var selectedRequirement = allowedRequirements.FirstOrDefault();

            return selectedRequirement;
        }

        public abstract Task<Core.Models.v2.PaymentPayloadHeader> CreateHeaderAsync(Core.Models.v2.PaymentRequirements requirement, CancellationToken cancellationToken = default);
        #endregion
    }
}


