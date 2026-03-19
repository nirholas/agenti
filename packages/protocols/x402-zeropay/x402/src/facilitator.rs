use crate::{
    DiscoveryRequest, DiscoveryResponse, Error, Pagination, Payee, PaymentRequirementsResponse,
    PaymentScheme, SettlementResponse, SupportedResponse, SupportedScheme, VerifyRequest,
    VerifyResponse, X402_VERSION,
};
use std::collections::HashMap;

/// The main facilitator for all payment scheme
pub struct Facilitator {
    schemes: HashMap<String, Box<dyn PaymentScheme>>,
}

impl Default for Facilitator {
    fn default() -> Self {
        Self::new()
    }
}

impl Facilitator {
    /// Create new facilitator
    pub fn new() -> Self {
        Self {
            schemes: HashMap::new(),
        }
    }

    /// Register new payment scheme to it
    pub fn register<T: PaymentScheme + 'static>(&mut self, scheme: T) {
        let identity = scheme.identity();
        self.schemes.insert(identity, Box::new(scheme));
    }

    /// Create a payment for the client
    pub fn create(&self, price: &str, payee: Payee) -> PaymentRequirementsResponse {
        let mut payments = Vec::new();
        for (_, scheme) in self.schemes.iter() {
            payments.extend(scheme.create(price, payee.clone()));
        }

        PaymentRequirementsResponse {
            x402_version: X402_VERSION.to_owned(),
            error: "".to_owned(),
            accepts: payments,
        }
    }

    /// Verify the payment request
    pub async fn verify(&self, req: &VerifyRequest) -> VerifyResponse {
        let identity = format!(
            "{}-{}",
            req.payment_payload.scheme, req.payment_payload.network
        );
        if let Some(scheme) = self.schemes.get(&identity) {
            scheme.verify(req).await
        } else {
            VerifyResponse {
                is_valid: false,
                invalid_reason: Some(Error::UnsupportedScheme.to_code().0.to_owned()),
                payer: req.payment_payload.payload.authorization.from.clone(),
            }
        }
    }

    /// Settle the payment request
    pub async fn settle(&self, req: &VerifyRequest) -> SettlementResponse {
        let identity = format!(
            "{}-{}",
            req.payment_payload.scheme, req.payment_payload.network
        );
        if let Some(scheme) = self.schemes.get(&identity) {
            scheme.settle(req).await
        } else {
            SettlementResponse {
                success: false,
                error_reason: Some(Error::UnsupportedScheme.to_code().0.to_owned()),
                transaction: "".to_owned(),
                network: req.payment_payload.network.clone(),
                payer: req.payment_payload.payload.authorization.from.clone(),
                feedback_auth: None,
            }
        }
    }

    /// List the supported schemes
    pub fn support(&self) -> SupportedResponse {
        let mut kinds = vec![];
        for (_, scheme) in self.schemes.iter() {
            kinds.push(SupportedScheme {
                x402_version: X402_VERSION.to_owned(),
                scheme: scheme.scheme().to_owned(),
                network: scheme.network().to_owned(),
            });
        }
        SupportedResponse { kinds }
    }

    /// List the discovery response
    pub fn discovery(&self, req: DiscoveryRequest) -> DiscoveryResponse {
        let pagination = Pagination {
            limit: req.limit.unwrap_or(20),
            offset: req.offset.unwrap_or(0),
            total: 0,
        };

        let items = vec![]; // TODO build the resource

        DiscoveryResponse {
            x402_version: X402_VERSION.to_owned(),
            items,
            pagination,
        }
    }
}
