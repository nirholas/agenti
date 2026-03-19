use x402_core::{
    transport::{PaymentPayload, PaymentRequirements, PaymentResource},
    types::{Extension, Record},
};

/// High-level trait for signing x402 payments.
///
/// Implementors can match against `PaymentRequirements` and produce a signed `PaymentPayload`.
/// Use tuple composition `(A, B)` to combine multiple signers without dynamic dispatch.
pub trait PaymentSigner {
    type Error: std::error::Error;

    /// Returns `true` if this signer can handle the given payment requirements.
    fn matches(&self, requirements: &PaymentRequirements) -> bool;

    /// Sign a payment, producing a complete `PaymentPayload`.
    fn sign_payment(
        &self,
        requirements: &PaymentRequirements,
        resource: &PaymentResource,
        extensions: &Record<Extension>,
    ) -> impl Future<Output = Result<PaymentPayload, Self::Error>> + Send;
}

/// Tuple composition: tries `A` first, falls back to `B`.
impl<A, B> PaymentSigner for (A, B)
where
    A: PaymentSigner + Sync,
    B: PaymentSigner<Error = A::Error> + Sync,
{
    type Error = A::Error;

    fn matches(&self, requirements: &PaymentRequirements) -> bool {
        self.0.matches(requirements) || self.1.matches(requirements)
    }

    async fn sign_payment(
        &self,
        requirements: &PaymentRequirements,
        resource: &PaymentResource,
        extensions: &Record<Extension>,
    ) -> Result<PaymentPayload, Self::Error> {
        if self.0.matches(requirements) {
            self.0
                .sign_payment(requirements, resource, extensions)
                .await
        } else {
            self.1
                .sign_payment(requirements, resource, extensions)
                .await
        }
    }
}
