use x402_core::transport::PaymentRequirements;

use crate::signer::PaymentSigner;

/// Select the first `PaymentRequirements` that the signer can handle.
pub fn select_requirements<'a, S: PaymentSigner>(
    accepts: &'a [PaymentRequirements],
    signer: &S,
) -> Option<&'a PaymentRequirements> {
    accepts.iter().find(|req| signer.matches(req))
}
