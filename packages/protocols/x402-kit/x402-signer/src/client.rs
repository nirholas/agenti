use x402_core::transport::{PaymentPayload, PaymentRequired};

use crate::{errors::SigningError, selector::select_requirements, signer::PaymentSigner};

/// High-level signing client that wraps a `PaymentSigner` and handles requirement selection.
pub struct X402Client<P> {
    signer: P,
}

impl<P: PaymentSigner> X402Client<P> {
    pub fn new(signer: P) -> Self {
        Self { signer }
    }

    /// Given a `PaymentRequired` (HTTP 402) response, select a compatible
    /// payment method, sign it, and return the `PaymentPayload`.
    pub async fn create_payment(
        &self,
        payment_required: &PaymentRequired,
    ) -> Result<PaymentPayload, SigningError> {
        let accepts = payment_required.accepts.as_ref();
        let requirements = select_requirements(accepts, &self.signer)
            .ok_or(SigningError::NoMatchingRequirements)?;

        self.signer
            .sign_payment(
                requirements,
                &payment_required.resource,
                &payment_required.extensions,
            )
            .await
            .map_err(|e| SigningError::Signer(e.to_string()))
    }

    /// Access the inner signer.
    pub fn signer(&self) -> &P {
        &self.signer
    }
}
