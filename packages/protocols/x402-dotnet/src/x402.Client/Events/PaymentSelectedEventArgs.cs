namespace x402.Client.Events
{
    public class PaymentSelectedEventArgs<T> : EventArgs where T : class
    {
        public HttpRequestMessage Request { get; }
        public T? PaymentRequirements { get; }

        public PaymentSelectedEventArgs(HttpRequestMessage request, T? selectedRequirement)
        {
            Request = request;
            PaymentRequirements = selectedRequirement;
        }
    }
}
