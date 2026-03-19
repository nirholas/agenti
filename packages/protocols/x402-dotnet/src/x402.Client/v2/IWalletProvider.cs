using x402.Client.Events;
using x402.Core.Models.v2;

namespace x402.Client.v2
{
    public interface IWalletProvider
    {
        public IX402WalletV2? Wallet { get; set; }

        Task<bool> RaisePrepareWallet(PrepareWalletEventArgs<PaymentRequiredResponse> paymentRequiredEventArgs);
        event PrepareWalletventHandler<PaymentRequiredResponse>? PrepareWallet;


        event EventHandler<PaymentSelectedEventArgs<PaymentRequirements>>? PaymentSelected;
        void RaiseOnPaymentSelected(PaymentSelectedEventArgs<PaymentRequirements> e);

        void RaiseOnHeaderCreated(HeaderCreatedEventArgs<PaymentPayloadHeader> e);
        event EventHandler<HeaderCreatedEventArgs<PaymentPayloadHeader>>? HeaderCreated;
    }
}
