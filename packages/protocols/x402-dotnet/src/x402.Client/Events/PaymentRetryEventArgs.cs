namespace x402.Client.Events
{
    public class HeaderCreatedEventArgs<T> : EventArgs where T : class
    {
        public T PaymentPayloadHeader { get; }
        public int Attempt { get; }

        public HeaderCreatedEventArgs(T paymentPayloadHeader, int attempt)
        {
            PaymentPayloadHeader = paymentPayloadHeader;
            Attempt = attempt;
        }
    }
}
