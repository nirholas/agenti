using x402.Core.Models.Facilitator;

namespace x402.Facilitator
{
    public class PaymentServiceFactory
    {
        private readonly Dictionary<FacilitatorKind, PaymentServiceRegistration> _services = new();

        /// <summary>
        /// Registers a payment service for a specific network.
        /// </summary>
        /// <param name="kind">The FacilitatorKind associated with this service (contains network information).</param>
        /// <param name="service">The payment service implementation.</param>
        public void Register(FacilitatorKind kind, IPaymentService service)
        {
            ArgumentNullException.ThrowIfNull(kind);
            ArgumentNullException.ThrowIfNull(service);

            _services[kind] = new PaymentServiceRegistration(kind, service);
        }

        /// <summary>
        /// Registers a payment service for a specific network.
        /// </summary>
        /// <param name="kind">The FacilitatorKind associated with this service (contains network information).</param>
        /// <param name="serviceFactory">A factory function to create the payment service implementation.</param>
        public void Register(FacilitatorKind kind, Func<IPaymentService> serviceFactory)
        {
            ArgumentNullException.ThrowIfNull(kind);
            ArgumentNullException.ThrowIfNull(serviceFactory);

            _services[kind] = new PaymentServiceRegistration(kind, serviceFactory);
        }

        /// <summary>
        /// Gets a payment service for the specified FacilitatorKind.
        /// </summary>
        /// <param name="kind">The FacilitatorKind.</param>
        /// <returns>The payment service for the kind, or null if not found.</returns>
        public IPaymentService? GetPaymentService(FacilitatorKind kind)
        {
            ArgumentNullException.ThrowIfNull(kind);

            if (!_services.TryGetValue(kind, out var registration))
            {
                return null;
            }

            return registration.GetService();
        }

        /// <summary>
        /// Gets a payment service for the specified network.
        /// </summary>
        /// <param name="network">The network identifier.</param>
        /// <returns>The payment service for the network, or null if not found.</returns>
        public IPaymentService? GetPaymentServiceByNetwork(string network)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(network);

            var kind = _services.Keys.FirstOrDefault(k =>
                string.Equals(k.Network, network, StringComparison.OrdinalIgnoreCase));

            if (kind == null)
            {
                return null;
            }

            return _services[kind].GetService();
        }

        /// <summary>
        /// Gets the FacilitatorKind for the specified network.
        /// </summary>
        /// <param name="network">The network identifier.</param>
        /// <returns>The FacilitatorKind for the network, or null if not found.</returns>
        public FacilitatorKind? GetKindByNetwork(string network)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(network);

            return _services.Keys.FirstOrDefault(k =>
                string.Equals(k.Network, network, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Gets all registered FacilitatorKinds.
        /// </summary>
        /// <returns>A list of all registered FacilitatorKinds.</returns>
        public List<FacilitatorKind> GetAllKinds()
        {
            return _services.Keys.ToList();
        }

        /// <summary>
        /// Gets all registered network names.
        /// </summary>
        /// <returns>A list of all registered network names.</returns>
        public List<string> GetAllNetworks()
        {
            return _services.Keys.Select(k => k.Network).Distinct().ToList();
        }

        /// <summary>
        /// Checks if a payment service is registered for the specified FacilitatorKind.
        /// </summary>
        /// <param name="kind">The FacilitatorKind.</param>
        /// <returns>True if a service is registered, false otherwise.</returns>
        public bool IsRegistered(FacilitatorKind kind)
        {
            if (kind == null)
            {
                return false;
            }

            return _services.ContainsKey(kind);
        }

        /// <summary>
        /// Checks if a payment service is registered for the specified network.
        /// </summary>
        /// <param name="network">The network identifier.</param>
        /// <returns>True if a service is registered, false otherwise.</returns>
        public bool IsRegisteredByNetwork(string network)
        {
            if (string.IsNullOrWhiteSpace(network))
            {
                return false;
            }

            return _services.Keys.Any(k =>
                string.Equals(k.Network, network, StringComparison.OrdinalIgnoreCase));
        }

        private class PaymentServiceRegistration
        {
            public FacilitatorKind Kind { get; }
            private readonly IPaymentService? _service;
            private readonly Func<IPaymentService>? _serviceFactory;

            public PaymentServiceRegistration(FacilitatorKind kind, IPaymentService service)
            {
                Kind = kind;
                _service = service;
            }

            public PaymentServiceRegistration(FacilitatorKind kind, Func<IPaymentService> serviceFactory)
            {
                Kind = kind;
                _serviceFactory = serviceFactory;
            }

            public IPaymentService GetService()
            {
                if (_service != null)
                {
                    return _service;
                }

                if (_serviceFactory != null)
                {
                    return _serviceFactory();
                }

                throw new InvalidOperationException("No service or factory available");
            }
        }
    }
}
