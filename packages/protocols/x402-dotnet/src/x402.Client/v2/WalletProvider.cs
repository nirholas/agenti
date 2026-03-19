using x402.Client.Events;
using x402.Core.Models.v2;

namespace x402.Client.v2
{
    public class WalletProvider : IWalletProvider
    {
        public IX402WalletV2? Wallet { get; set; }
        public WalletProvider(IX402WalletV2? wallet = null)
        {
            Wallet = wallet;
        }

        public event PrepareWalletventHandler<PaymentRequiredResponse>? PrepareWallet;
        public event EventHandler<PaymentSelectedEventArgs<PaymentRequirements>>? PaymentSelected;
        public event EventHandler<HeaderCreatedEventArgs<PaymentPayloadHeader>>? HeaderCreated;

        public virtual async Task<bool> RaisePrepareWallet(PrepareWalletEventArgs<PaymentRequiredResponse> e)
        {
            var canContinue = true;
            if (PrepareWallet != null)
            {
                // If any subscriber returns false, we should not continue
                foreach (PrepareWalletventHandler<PaymentRequiredResponse> handler in PrepareWallet.GetInvocationList())
                {
                    if (!await handler(this, e))
                    {
                        canContinue = false;
                        break;
                    }
                }
            }
            return canContinue;
        }

        public virtual void RaiseOnPaymentSelected(PaymentSelectedEventArgs<PaymentRequirements> e)
            => PaymentSelected?.Invoke(this, e);

        public virtual void RaiseOnHeaderCreated(HeaderCreatedEventArgs<PaymentPayloadHeader> e)
            => HeaderCreated?.Invoke(this, e);
    }
}
