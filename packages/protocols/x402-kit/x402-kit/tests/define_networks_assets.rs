use std::{fmt::Display, str::FromStr};

use alloy_primitives::address;
use solana_pubkey::pubkey;
use x402_kit::{
    core::{Address, NetworkFamily},
    networks::{
        evm::{
            Eip712Domain, EvmAddress, EvmAsset, EvmNetwork, ExplicitEvmAsset, ExplicitEvmNetwork,
        },
        svm::{ExplicitSvmAsset, ExplicitSvmNetwork, SvmAddress, SvmAsset, SvmNetwork},
    },
};

#[test]
fn test_define_new_svm_network() {
    struct CustomSvmNetwork;

    impl ExplicitSvmNetwork for CustomSvmNetwork {
        const NETWORK: SvmNetwork = SvmNetwork {
            name: "custom-svm-network",
            caip_2_id: "solana:genesis_block_hash",
        };
    }

    let network: SvmNetwork = CustomSvmNetwork::NETWORK;
    assert_eq!(network.network_name(), "custom-svm-network");
    assert_eq!(network.network_id(), "solana:genesis_block_hash");
}

#[test]
fn test_define_new_svm_asset() {
    struct MyCustomSvmNetwork;
    impl ExplicitSvmNetwork for MyCustomSvmNetwork {
        const NETWORK: SvmNetwork = SvmNetwork {
            name: "custom-svm-network",
            caip_2_id: "solana:genesis_block_hash",
        };
    }

    struct MyCustomSvmToken;
    impl ExplicitSvmAsset for MyCustomSvmToken {
        type Network = MyCustomSvmNetwork;

        const ASSET: SvmAsset = SvmAsset {
            address: SvmAddress(pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")),
            decimals: 9,
            name: "My Custom SVM Token",
            symbol: "MCST",
        };
    }

    let asset: SvmAsset = MyCustomSvmToken::ASSET;
    assert_eq!(asset.decimals, 9);
    assert_eq!(asset.name, "My Custom SVM Token");
    assert_eq!(asset.symbol, "MCST");
    assert_eq!(
        asset.address.to_string(),
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    );
}

#[test]
fn test_define_new_evm_network() {
    struct CustomEvmNetwork;

    impl ExplicitEvmNetwork for CustomEvmNetwork {
        const NETWORK: EvmNetwork = EvmNetwork {
            name: "custom-evm-network",
            chain_id: 12345,
            network_id: "eip155:12345",
        };
    }

    let network: EvmNetwork = CustomEvmNetwork::NETWORK;
    assert_eq!(network.network_name(), "custom-evm-network");
    assert_eq!(network.chain_id, 12345);
}

#[test]
fn test_define_new_evm_asset() {
    struct MyCustomNetwork;
    impl ExplicitEvmNetwork for MyCustomNetwork {
        const NETWORK: EvmNetwork = EvmNetwork {
            name: "my-network",
            chain_id: 99999,
            network_id: "eip155:99999",
        };
    }

    struct MyCustomToken;
    impl ExplicitEvmAsset for MyCustomToken {
        type Network = MyCustomNetwork;

        const ASSET: EvmAsset = EvmAsset {
            address: EvmAddress(address!("0x1234567890123456789012345678901234567890")),
            decimals: 18,
            name: "My Custom Token",
            symbol: "MCT",
        };

        const EIP712_DOMAIN: Option<Eip712Domain> = Some(Eip712Domain {
            name: "My Custom Token",
            version: "1",
        });
    }

    let asset: EvmAsset = MyCustomToken::ASSET;
    assert_eq!(asset.decimals, 18);
    assert_eq!(asset.name, "My Custom Token");
    assert_eq!(asset.symbol, "MCT");
    assert_eq!(
        asset.address.to_string(),
        "0x1234567890123456789012345678901234567890"
    );

    let domain = MyCustomToken::EIP712_DOMAIN;
    assert!(domain.is_some());
    assert_eq!(domain.unwrap().name, "My Custom Token");
    assert_eq!(domain.unwrap().version, "1");
}

#[test]
fn test_define_network_family() {
    struct MyNetworkFamily {
        network_name: &'static str,
        network_id: &'static str,
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    struct MyAddress(u64);

    impl FromStr for MyAddress {
        type Err = ();

        fn from_str(s: &str) -> Result<Self, Self::Err> {
            s.parse::<u64>().map(MyAddress).map_err(|_| ())
        }
    }

    impl Display for MyAddress {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "{}", self.0)
        }
    }

    impl NetworkFamily for MyNetworkFamily {
        fn network_name(&self) -> &str {
            self.network_name
        }
        fn network_id(&self) -> &str {
            self.network_id
        }
    }

    impl Address for MyAddress {
        type Network = MyNetworkFamily;
    }

    pub type _MyAsset = x402_kit::core::Asset<MyAddress>;

    let network = MyNetworkFamily {
        network_name: "my-network",
        network_id: "42",
    };
    assert_eq!(network.network_name(), "my-network");
    assert_eq!(network.network_id(), "42");

    let address: MyAddress = "100".parse().unwrap();
    assert_eq!(address.to_string(), "100");
}
