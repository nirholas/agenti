use std::{
    fmt::{Debug, Display},
    str::FromStr,
};

use serde::{Deserialize, Serialize};
use solana_pubkey::{ParsePubkeyError, Pubkey};

use x402_core::core::{Address, NetworkFamily};

pub mod exact;

pub struct SvmNetwork {
    pub name: &'static str,
    pub caip_2_id: &'static str,
}

impl NetworkFamily for SvmNetwork {
    fn network_name(&self) -> &str {
        self.name
    }

    fn network_id(&self) -> &str {
        self.caip_2_id
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct SvmAddress(pub Pubkey);

impl From<Pubkey> for SvmAddress {
    fn from(pk: Pubkey) -> Self {
        SvmAddress(pk)
    }
}

impl FromStr for SvmAddress {
    type Err = ParsePubkeyError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let pk = Pubkey::from_str(s)?;
        Ok(SvmAddress(pk))
    }
}

impl Display for SvmAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Debug for SvmAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SvmAddress({})", self.0)
    }
}

impl Serialize for SvmAddress {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for SvmAddress {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let pk = Pubkey::from_str(&s).map_err(serde::de::Error::custom)?;
        Ok(SvmAddress(pk))
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct SvmSignature(pub solana_signature::Signature);

impl FromStr for SvmSignature {
    type Err = solana_signature::ParseSignatureError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let sig = solana_signature::Signature::from_str(s)?;
        Ok(SvmSignature(sig))
    }
}

impl Debug for SvmSignature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SvmSignature({})", self.0)
    }
}

impl Display for SvmSignature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Serialize for SvmSignature {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for SvmSignature {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let sig = solana_signature::Signature::from_str(&s).map_err(serde::de::Error::custom)?;
        Ok(SvmSignature(sig))
    }
}

impl Address for SvmAddress {
    type Network = SvmNetwork;
}

pub type SvmAsset = x402_core::core::Asset<SvmAddress>;

pub trait ExplicitSvmNetwork {
    const NETWORK: SvmNetwork;
}

pub trait ExplicitSvmAsset {
    type Network: ExplicitSvmNetwork;
    const ASSET: SvmAsset;
}

pub mod networks {
    use super::*;

    pub struct Solana;
    impl ExplicitSvmNetwork for Solana {
        const NETWORK: SvmNetwork = SvmNetwork {
            name: "solana",
            caip_2_id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        };
    }

    pub struct SolanaDevnet;
    impl ExplicitSvmNetwork for SolanaDevnet {
        const NETWORK: SvmNetwork = SvmNetwork {
            name: "solana-devnet",
            caip_2_id: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        };
    }

    pub struct SolanaTestnet;
    impl ExplicitSvmNetwork for SolanaTestnet {
        const NETWORK: SvmNetwork = SvmNetwork {
            name: "solana-testnet",
            caip_2_id: "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
        };
    }
}

pub mod assets {
    use solana_pubkey::pubkey;

    use super::*;

    macro_rules! create_usdc {
        ($addr:expr) => {
            SvmAsset {
                address: SvmAddress($addr),
                decimals: 6,
                name: "USD Coin",
                symbol: "USDC",
            }
        };
    }

    pub struct UsdcSolana;
    impl ExplicitSvmAsset for UsdcSolana {
        type Network = networks::Solana;
        const ASSET: SvmAsset =
            create_usdc!(pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"));
    }

    pub struct UsdcSolanaDevnet;
    impl ExplicitSvmAsset for UsdcSolanaDevnet {
        type Network = networks::SolanaDevnet;
        const ASSET: SvmAsset =
            create_usdc!(pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"));
    }
}
