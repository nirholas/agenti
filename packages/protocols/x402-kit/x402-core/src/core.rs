//! Core traits and types used across the X402 Kit.

use std::{fmt::Display, str::FromStr};

use bon::Builder;
use url::Url;

use crate::types::{AmountValue, AnyJson, Extension, OutputSchema, Record};

/// A series of network families, e.g. EVM, SVM, etc.
pub trait NetworkFamily {
    /// The name of the network in the family, should be compatible with X402 V1.
    fn network_name(&self) -> &str;

    /// The Blockchain network identifier in CAIP-2 format (e.g., "eip155:84532")
    fn network_id(&self) -> &str;
}

/// Network-specific address type.
pub trait Address: FromStr + Display + Copy {
    /// The network family this address belongs to.
    type Network: NetworkFamily;
}

/// A payment scheme applied to a network family.
pub trait Scheme {
    /// The network family this scheme applies to.
    type Network: NetworkFamily;
    /// The payload type produced by this scheme.
    type Payload;
    /// The name of the scheme.
    const SCHEME_NAME: &'static str;
    /// Get the concrete network for this scheme.
    fn network(&self) -> &Self::Network;
}

/// Represents an asset on a given address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Asset<A: Address> {
    /// The address of the asset.
    pub address: A,
    /// The number of decimals the asset uses.
    pub decimals: u8,
    /// The name of the asset.
    pub name: &'static str,
    /// The symbol of the asset.
    pub symbol: &'static str,
}

/// Payment configuration for a given scheme and transport.
///
/// The payment configuration uses a static asset implementation. See [`Asset`].
#[derive(Builder)]
pub struct Payment<S, A>
where
    S: Scheme,
    A: Address<Network = S::Network>,
{
    /// The payment scheme.
    pub scheme: S,
    /// The address to use for payments.
    #[builder(into)]
    pub pay_to: A,
    /// The asset for the payment
    #[builder(into)]
    pub asset: Asset<A>,
    /// The amount of the asset to pay, in smallest units.
    #[builder(into)]
    pub amount: AmountValue,
    /// Maximum timeout in seconds for the payment to be completed.
    pub max_timeout_seconds: u64,
    /// Optional extra data for the payment.
    pub extra: Option<AnyJson>,
}

/// The selected payment for the signer to sign.
///
/// Selected payment only knows about the asset's address, not full asset details.
#[derive(Builder)]
pub struct PaymentSelection<A: Address> {
    /// The address to use for payments.
    #[builder(into)]
    pub pay_to: A,
    /// The asset for the payment
    #[builder(into)]
    pub asset: A,
    /// The amount of the asset to pay, in smallest units.
    #[builder(into)]
    pub amount: AmountValue,
    /// Maximum timeout in seconds for the payment to be completed.
    pub max_timeout_seconds: u64,
    /// Optional extra data for the payment.
    pub extra: Option<AnyJson>,
    /// Resource definition.
    pub resource: Resource,
    /// Extensions
    #[builder(default)]
    pub extensions: Record<Extension>,
}

/// Signer for a given payment scheme.
pub trait SchemeSigner<A: Address<Network = <Self::Scheme as Scheme>::Network>> {
    /// The payment scheme this signer supports.
    type Scheme: Scheme;

    /// The error type for signing failures.
    type Error: std::error::Error;

    /// Sign the given payment selection, producing a payload.
    fn sign(
        &self,
        payment: &PaymentSelection<A>,
    ) -> impl Future<Output = Result<<Self::Scheme as Scheme>::Payload, Self::Error>>;
}

/// Resource definition.
#[derive(Builder, Debug, Clone, PartialEq, Eq)]
pub struct Resource {
    /// Optional resource URL.
    pub url: Url,
    /// Optional description of the resource.
    #[builder(into)]
    pub description: String,
    /// Optional MIME type of the resource.
    #[builder(into)]
    pub mime_type: String,
    /// Optional output schema for the payment payload.
    pub output_schema: Option<OutputSchema>,
}
