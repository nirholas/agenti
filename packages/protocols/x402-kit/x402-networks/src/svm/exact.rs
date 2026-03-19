use bon::Builder;
use serde::{Deserialize, Serialize};

use x402_core::{
    core::{Payment, Scheme},
    transport::PaymentRequirements,
};

use crate::svm::{ExplicitSvmAsset, ExplicitSvmNetwork, SvmAddress, SvmNetwork};

#[derive(Builder, Debug, Clone)]
pub struct ExactSvm<A: ExplicitSvmAsset> {
    pub asset: A,
    #[builder(into)]
    pub pay_to: SvmAddress,
    pub amount: u64,
    pub max_timeout_seconds_override: Option<u64>,
}

impl<A: ExplicitSvmAsset> From<ExactSvm<A>> for Payment<ExactSvmScheme, SvmAddress> {
    fn from(scheme: ExactSvm<A>) -> Self {
        Payment {
            scheme: ExactSvmScheme(A::Network::NETWORK),
            pay_to: scheme.pay_to,
            asset: A::ASSET,
            amount: scheme.amount.into(),
            max_timeout_seconds: scheme.max_timeout_seconds_override.unwrap_or(300),
            extra: None,
        }
    }
}

impl<A: ExplicitSvmAsset> From<ExactSvm<A>> for PaymentRequirements {
    fn from(scheme: ExactSvm<A>) -> Self {
        PaymentRequirements::from(Payment::from(scheme))
    }
}

pub struct ExactSvmScheme(pub SvmNetwork);

impl Scheme for ExactSvmScheme {
    type Network = SvmNetwork;
    type Payload = ExplicitSvmPayload;
    const SCHEME_NAME: &'static str = "exact";

    fn network(&self) -> &Self::Network {
        &self.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplicitSvmPayload {
    pub transaction: String,
}

#[cfg(test)]
mod tests {
    use solana_pubkey::pubkey;

    use crate::svm::assets::UsdcSolanaDevnet;

    use super::*;

    #[test]
    fn test_build_payment_requirements() {
        let pr: PaymentRequirements = ExactSvm::builder()
            .asset(UsdcSolanaDevnet)
            .amount(1000)
            .pay_to(pubkey!("Ge3jkza5KRfXvaq3GELNLh6V1pjjdEKNpEdGXJgjjKUR"))
            .build()
            .into();

        assert_eq!(pr.scheme, "exact");
        assert_eq!(pr.network, "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
        assert_eq!(pr.amount, 1000u64.into());
        assert!(pr.extra.is_none());
    }
}
