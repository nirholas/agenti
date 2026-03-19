//! HTTP Paywall using X402 payments and a facilitator.
//!
//! For details, see the [`PayWall`] struct documentation.

use std::fmt::Display;

use bon::Builder;
use x402_core::{
    core::Resource,
    facilitator::{Facilitator, SupportedResponse},
    transport::{Accepts, PaymentPayload},
    types::{Base64EncodedHeader, Extension, Record},
};

use crate::{
    HttpRequest, HttpResponse,
    errors::ErrorResponse,
    processor::{PaymentState, RequestProcessor},
};

/// A HTTP paywall that uses a facilitator to verify and settle payments.
///
/// `PayWall` provides a flexible and composable API for protecting resources with X402 payments.
/// It handles the full payment flow including verification and settlement through a configured facilitator.
///
/// ## Type Parameters
///
/// - `F`: The facilitator type that implements [`Facilitator`] for payment verification and settlement.
///
/// ## Building a PayWall
///
/// Use the builder pattern to construct a `PayWall`. You need:
/// - A facilitator client for payment verification/settlement
/// - Payment requirements (what payments you accept)
/// - Resource configuration (what you're protecting)
///
/// See the [`x402-kit` documentation](https://docs.rs/x402-kit) for complete examples.
///
/// ## Step-by-Step API
///
/// The [`handle_payment`](PayWall::handle_payment) method provides a standard payment flow that internally
/// uses the step-by-step API. It performs the following operations in order:
///
/// 1. **Update Accepts** ([`update_accepts`](PayWall::update_accepts)): Filters accepted payment requirements
///    based on what the facilitator supports.
/// 2. **Process Request** ([`process_request`](PayWall::process_request)): Extracts and validates the
///    `PAYMENT-SIGNATURE` header, creating a [`RequestProcessor`].
/// 3. **Verify** ([`RequestProcessor::verify`](crate::processor::RequestProcessor::verify)): Verifies the
///    payment signature with the facilitator.
/// 4. **Run Handler** ([`RequestProcessor::run_handler`](crate::processor::RequestProcessor::run_handler)):
///    Executes the resource handler, injecting [`PaymentState`] into request extensions.
/// 5. **Settle on Success** ([`ResponseProcessor::settle_on_success`](crate::processor::ResponseProcessor::settle_on_success)):
///    Settles the payment only if the handler returned a successful response.
///
/// ## Custom Payment Flow
///
/// For more control, use the step-by-step API directly. You can skip steps, reorder them,
/// or add custom logic between steps. For example, you might skip verification, settle before
/// running the handler, or add logging between steps.
#[derive(Builder, Debug, Clone)]
pub struct PayWall<F: Facilitator> {
    /// The facilitator to use for payment verification and settlement.
    pub facilitator: F,
    /// The resource this paywall serves.
    pub resource: Resource,
    /// The accepted payment requirements.
    #[builder(into)]
    pub accepts: Accepts,
    /// Additional extensions to use.
    #[builder(default)]
    pub extensions: Record<Extension>,
}

impl<F: Facilitator> PayWall<F> {
    /// Entrypoint of an X402 payment flow.
    ///
    /// Process an incoming request and extract payment information.
    ///
    /// Returns a [`RequestProcessor`] on success for further processing.
    pub fn process_request<'pw, Req: HttpRequest>(
        &'pw self,
        request: Req,
    ) -> Result<RequestProcessor<'pw, F, Req>, ErrorResponse> {
        let payment_signature = request
            .get_header("PAYMENT-SIGNATURE")
            .ok_or_else(|| self.payment_required())
            .and_then(|h| {
                str::from_utf8(h).map_err(|err| {
                    self.invalid_payment(format!(
                        "Failed to decode PAYMENT-SIGNATURE header: {err}"
                    ))
                })
            })
            .map(|s| Base64EncodedHeader(s.to_string()))?;

        let payload = PaymentPayload::try_from(payment_signature.clone()).map_err(|err| {
            self.invalid_payment(format!("Failed to parse PAYMENT-SIGNATURE header: {err}"))
        })?;

        let initial_state = PaymentState {
            verified: None,
            settled: None,
            required_extensions: self.extensions.to_owned(),
            payload_extensions: payload.extensions.clone(),
        };

        let selected = self
            .accepts
            .clone()
            .into_iter()
            // Match a PaymentRequirements with PartialEq
            .find(|a| a == &payload.accepted)
            .ok_or_else(|| self.invalid_payment("PaymentRequirements in payload not accepted"))?;

        Ok(RequestProcessor {
            paywall: self,
            selected,
            request,
            payload,
            payment_state: initial_state,
        })
    }

    /// Standard payment handling flow.
    ///
    /// This handler will **update** the accepted payment requirements from the facilitator,
    /// **verify** the payment, **run** the provided resource handler, and **settle** the payment on success.
    pub async fn handle_payment<Fun, Fut, Req, Res>(
        self,
        request: Req,
        handler: Fun,
    ) -> Result<Res, ErrorResponse>
    where
        Fun: FnOnce(Req) -> Fut,
        Fut: Future<Output = Res>,
        Req: HttpRequest,
        Res: HttpResponse,
    {
        let response = self
            .update_accepts()
            .await?
            .process_request(request)?
            .verify()
            .await?
            .run_handler(handler)
            .await?
            .settle_on_success()
            .await?
            .response();

        Ok(response)
    }

    /// Update the accepted payment requirements based on the facilitator's supported kinds.
    pub async fn update_accepts(mut self) -> Result<Self, ErrorResponse> {
        let supported = self.facilitator.supported().await.map_err(|err| {
            self.server_error(format!("Failed to get supported payment kinds: {err}"))
        })?;
        let filtered = filter_supported_accepts(&supported, self.accepts.to_owned());
        self.accepts = filtered;

        Ok(self)
    }

    /// Payment needed to access resource
    pub fn payment_required(&self) -> ErrorResponse {
        ErrorResponse::payment_required(
            self.resource.to_owned().into(),
            self.accepts.to_owned(),
            self.extensions.to_owned(),
        )
    }

    /// Malformed payment payload or requirements
    pub fn invalid_payment(&self, reason: impl Display) -> ErrorResponse {
        ErrorResponse::invalid_payment(
            reason,
            self.resource.to_owned().into(),
            self.accepts.to_owned(),
            self.extensions.to_owned(),
        )
    }

    /// Payment verification or settlement failed
    pub fn payment_failed(&self, reason: impl Display) -> ErrorResponse {
        ErrorResponse::payment_failed(
            reason,
            self.resource.to_owned().into(),
            self.accepts.to_owned(),
            self.extensions.to_owned(),
        )
    }

    /// Internal server error during payment processing
    pub fn server_error(&self, reason: impl Display) -> ErrorResponse {
        ErrorResponse::server_error(
            reason,
            self.resource.to_owned().into(),
            self.accepts.to_owned(),
            self.extensions.to_owned(),
        )
    }
}

/// Filters the payment requirements based on the supported kinds from the facilitator.
///
/// Returns only the payment requirements that are supported by the facilitator with updated extra fields.
pub fn filter_supported_accepts(supported: &SupportedResponse, accepts: Accepts) -> Accepts {
    accepts
        .into_iter()
        .filter_map(|mut pr| {
            supported
                .kinds
                .iter()
                .find(|kind| {
                    kind.x402_version.as_v2().is_some()
                        && kind.scheme == pr.scheme
                        && kind.network == pr.network
                })
                .map(|s| {
                    // Update extra field if present
                    if s.extra.is_some() {
                        pr.extra = s.extra.clone();
                    }
                    pr
                })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use x402_core::{
        facilitator::SupportedResponse,
        transport::{Accepts, PaymentRequirements},
        types::AmountValue,
    };

    use crate::paywall::filter_supported_accepts;

    #[test]
    fn test_filter_supported_accepts() {
        let supported: SupportedResponse = serde_json::from_value(json!({
          "kinds": [
            {
              "x402Version": 2,
              "scheme": "exact",
              "network": "eip155:84532"
            },
            {
              "x402Version": 2,
              "scheme": "exact",
              "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
              "extra": {
                "feePayer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
              }
            },
            {
              "x402Version": 1,
              "scheme": "exact",
              "network": "base-sepolia"
            },
            {
              "x402Version": 1,
              "scheme": "exact",
              "network": "solana-devnet",
              "extra": {
                "feePayer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
              }
            }
          ],
          "extensions": [],
          "signers": {
            "eip155:*": [
              "0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf"
            ],
            "solana:*": [
              "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
            ]
          }
        }))
        .unwrap();

        let accepts = Accepts::from(vec![
            PaymentRequirements {
                scheme: "exact".to_string(),
                network: "eip155:84532".to_string(),
                amount: AmountValue(1000),
                asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".to_string(),
                pay_to: "0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20".to_string(),
                max_timeout_seconds: 60,
                extra: Some(json!({
                    "name": "USD Coin",
                    "version": "2"
                })),
            },
            PaymentRequirements {
                scheme: "exact".to_string(),
                network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1".to_string(),
                amount: AmountValue(2000000),
                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string(),
                pay_to: "Ge3jkza5KRfXvaq3GELNLh6V1pjjdEKNpEdGXJgjjKUR".to_string(),
                max_timeout_seconds: 60,
                extra: None,
            },
            PaymentRequirements {
                scheme: "exact".to_string(),
                network: "solana:UnknownNetwork".to_string(),
                amount: AmountValue(2000000),
                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string(),
                pay_to: "Ge3jkza5KRfXvaq3GELNLh6V1pjjdEKNpEdGXJgjjKUR".to_string(),
                max_timeout_seconds: 60,
                extra: None,
            },
        ]);

        let updated = filter_supported_accepts(&supported, accepts);

        assert_eq!(
            updated.as_ref().len(),
            2,
            "Only 2 payment requirements should be supported"
        );

        assert_eq!(
            updated.as_ref()[0].extra,
            Some(json!({
                "name": "USD Coin",
                "version": "2"
            })),
            "EVM payment requirement should retain extra"
        );

        assert_eq!(
            updated.as_ref()[1].extra,
            Some(json!({
                "feePayer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
            })),
            "Solana payment requirement should have updated extra from supported kinds"
        );
    }
}
