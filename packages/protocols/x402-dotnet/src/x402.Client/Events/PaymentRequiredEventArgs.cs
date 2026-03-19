namespace x402.Client.Events
{
    public delegate Task<bool> PrepareWalletventHandler<T>(object? sender, PrepareWalletEventArgs<T> e) where T : class;

    public class PrepareWalletEventArgs<T> : EventArgs where T : class
    {
        public HttpRequestMessage Request { get; }
        public HttpResponseMessage Response { get; }
        public T PaymentRequiredResponse { get; }

        public PrepareWalletEventArgs(HttpRequestMessage request, HttpResponseMessage response, T paymentRequiredResponse)
        {
            Request = request;
            Response = response;
            PaymentRequiredResponse = paymentRequiredResponse;
        }
    }
}
