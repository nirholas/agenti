use std::{
    fmt::{Debug, Display},
    str::FromStr,
};

use serde::{Deserialize, Serialize};

use x402_core::core::{Address, Asset, NetworkFamily};

pub mod exact;

#[derive(Debug, Clone, Copy)]
pub struct EvmNetwork {
    pub name: &'static str,
    pub chain_id: u64,
    pub network_id: &'static str,
}

impl NetworkFamily for EvmNetwork {
    fn network_name(&self) -> &str {
        self.name
    }
    fn network_id(&self) -> &str {
        self.network_id
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct EvmAddress(pub alloy_primitives::Address);

impl From<alloy_primitives::Address> for EvmAddress {
    fn from(addr: alloy_primitives::Address) -> Self {
        EvmAddress(addr)
    }
}

impl FromStr for EvmAddress {
    type Err = alloy_primitives::AddressError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let addr = alloy_primitives::Address::from_str(s)?;
        Ok(EvmAddress(addr))
    }
}

impl Display for EvmAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Debug for EvmAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "EvmAddress({})", self.0)
    }
}

impl Serialize for EvmAddress {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for EvmAddress {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        EvmAddress::from_str(&s).map_err(serde::de::Error::custom)
    }
}

impl Address for EvmAddress {
    type Network = EvmNetwork;
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct EvmSignature(pub alloy_primitives::Signature);

impl Display for EvmSignature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Debug for EvmSignature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "EvmSignature({})", self.0)
    }
}

impl FromStr for EvmSignature {
    type Err = alloy_primitives::SignatureError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let sig = alloy_primitives::Signature::from_str(s)?;
        Ok(EvmSignature(sig))
    }
}

impl Serialize for EvmSignature {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for EvmSignature {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        EvmSignature::from_str(&s).map_err(serde::de::Error::custom)
    }
}

impl From<alloy_primitives::Signature> for EvmSignature {
    fn from(sig: alloy_primitives::Signature) -> Self {
        EvmSignature(sig)
    }
}

pub type EvmAsset = Asset<EvmAddress>;

pub trait ExplicitEvmNetwork {
    const NETWORK: EvmNetwork;
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Eip712Domain {
    pub name: &'static str,
    pub version: &'static str,
}

pub trait ExplicitEvmAsset {
    type Network: ExplicitEvmNetwork;

    const ASSET: EvmAsset;
    const EIP712_DOMAIN: Option<Eip712Domain>;
}

impl<T> From<T> for EvmNetwork
where
    T: ExplicitEvmNetwork,
{
    fn from(_: T) -> Self {
        T::NETWORK
    }
}

pub mod networks {
    use super::*;

    macro_rules! define_explicit_evm_network {
        ($struct_name:ident, $network_const:expr) => {
            pub struct $struct_name;

            impl ExplicitEvmNetwork for $struct_name {
                const NETWORK: EvmNetwork = $network_const;
            }
        };
    }

    define_explicit_evm_network!(
        Ethereum,
        EvmNetwork {
            name: "ethereum",
            chain_id: 1,
            network_id: "eip155:1",
        }
    );
    define_explicit_evm_network!(
        EthereumSepolia,
        EvmNetwork {
            name: "ethereum-sepolia",
            chain_id: 11155111,
            network_id: "eip155:11155111",
        }
    );
    define_explicit_evm_network!(
        Base,
        EvmNetwork {
            name: "base",
            chain_id: 8453,
            network_id: "eip155:8453",
        }
    );
    define_explicit_evm_network!(
        BaseSepolia,
        EvmNetwork {
            name: "base-sepolia",
            chain_id: 84532,
            network_id: "eip155:84532",
        }
    );
}

pub mod assets {
    use alloy_primitives::address;

    use super::*;

    macro_rules! define_explicit_evm_asset {
        (
            $struct_name:ident,
            $network_struct:ty,
            $addr:expr,
            $decimals:expr,
            $name:expr,
            $symbol:expr,
            $eip712_domain:expr
        ) => {
            pub struct $struct_name;

            impl ExplicitEvmAsset for $struct_name {
                type Network = $network_struct;

                const ASSET: EvmAsset = EvmAsset {
                    address: EvmAddress(address!($addr)),
                    decimals: $decimals,
                    name: $name,
                    symbol: $symbol,
                };

                const EIP712_DOMAIN: Option<Eip712Domain> = $eip712_domain;
            }
        };
    }

    macro_rules! define_explicit_usdc {
        ($struct_name:ident, $network_struct:ty, $addr:expr) => {
            define_explicit_evm_asset!(
                $struct_name,
                $network_struct,
                $addr,
                6,
                "USD Coin",
                "USDC",
                Some(Eip712Domain {
                    name: "USD Coin",
                    version: "2",
                })
            );
        };
    }

    define_explicit_usdc!(
        UsdcEthereum,
        networks::Ethereum,
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );

    define_explicit_evm_asset!(
        UsdcEthereumSepolia,
        networks::EthereumSepolia,
        "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        6,
        "USDC",
        "USDC",
        Some(Eip712Domain {
            name: "USDC",
            version: "2",
        })
    );

    define_explicit_usdc!(
        UsdcBase,
        networks::Base,
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    );

    define_explicit_evm_asset!(
        UsdcBaseSepolia,
        networks::BaseSepolia,
        "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        6,
        "USDC",
        "USDC",
        Some(Eip712Domain {
            name: "USDC",
            version: "2",
        })
    );
}
