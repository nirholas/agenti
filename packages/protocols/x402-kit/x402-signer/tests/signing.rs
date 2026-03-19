use serde_json::json;
use x402_core::{
    transport::{Accepts, PaymentRequired, PaymentRequirements, PaymentResource},
    types::{AmountValue, Record, X402V2},
};
use x402_signer::signer::PaymentSigner;

fn test_resource() -> PaymentResource {
    PaymentResource {
        url: "https://example.com/api".parse().unwrap(),
        description: "Test resource".into(),
        mime_type: "application/json".into(),
    }
}

// ======================== EVM Tests ========================

#[cfg(feature = "evm")]
mod evm_tests {
    use super::*;
    use alloy::signers::local::PrivateKeySigner;
    use x402_signer::evm::{EvmPaymentSigner, EvmSigningError};

    fn evm_requirements_eip3009() -> PaymentRequirements {
        PaymentRequirements {
            scheme: "exact".into(),
            network: "eip155:84532".into(),
            amount: AmountValue(100_000),
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".into(),
            pay_to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF".into(),
            max_timeout_seconds: 300,
            extra: Some(json!({
                "name": "USD Coin",
                "version": "2"
            })),
        }
    }

    fn evm_requirements_permit2() -> PaymentRequirements {
        PaymentRequirements {
            scheme: "exact".into(),
            network: "eip155:84532".into(),
            amount: AmountValue(100_000),
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".into(),
            pay_to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF".into(),
            max_timeout_seconds: 300,
            extra: Some(json!({
                "transferMethod": "permit2"
            })),
        }
    }

    #[test]
    fn evm_signer_matches_eip155() {
        let signer = PrivateKeySigner::random();
        let evm = EvmPaymentSigner::new(signer);

        let req = evm_requirements_eip3009();
        assert!(evm.matches(&req));
    }

    #[test]
    fn evm_signer_rejects_svm() {
        let signer = PrivateKeySigner::random();
        let evm = EvmPaymentSigner::new(signer);

        let req = PaymentRequirements {
            scheme: "exact".into(),
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp".into(),
            amount: AmountValue(100_000),
            asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".into(),
            pay_to: "So11111111111111111111111111111111111111112".into(),
            max_timeout_seconds: 300,
            extra: None,
        };
        assert!(!evm.matches(&req));
    }

    #[tokio::test]
    async fn evm_sign_eip3009() {
        let signer = PrivateKeySigner::random();
        let evm = EvmPaymentSigner::new(signer);

        let req = evm_requirements_eip3009();
        let resource = test_resource();
        let extensions = Record::default();

        let result = evm.sign_payment(&req, &resource, &extensions).await;
        assert!(
            result.is_ok(),
            "EIP-3009 signing failed: {:?}",
            result.err()
        );

        let payload = result.unwrap();
        assert_eq!(payload.x402_version, X402V2);
        assert_eq!(payload.accepted, req);

        // Payload should contain signature and authorization fields
        let p = &payload.payload;
        assert!(p.get("signature").is_some(), "missing signature field");
        assert!(
            p.get("authorization").is_some(),
            "missing authorization field"
        );
    }

    #[tokio::test]
    async fn evm_sign_permit2() {
        let signer = PrivateKeySigner::random();
        let evm = EvmPaymentSigner::new(signer);

        let req = evm_requirements_permit2();
        let resource = test_resource();
        let extensions = Record::default();

        let result = evm.sign_payment(&req, &resource, &extensions).await;
        assert!(result.is_ok(), "Permit2 signing failed: {:?}", result.err());

        let payload = result.unwrap();
        let p = &payload.payload;
        assert!(p.get("signature").is_some(), "missing signature field");
        assert!(
            p.get("permit2Authorization").is_some(),
            "missing permit2Authorization field"
        );
    }

    #[tokio::test]
    async fn evm_sign_missing_eip712_domain() {
        let signer = PrivateKeySigner::random();
        let evm = EvmPaymentSigner::new(signer);

        // Missing name/version in extra → should fail for EIP-3009
        let req = PaymentRequirements {
            scheme: "exact".into(),
            network: "eip155:84532".into(),
            amount: AmountValue(100_000),
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".into(),
            pay_to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF".into(),
            max_timeout_seconds: 300,
            extra: None,
        };
        let resource = test_resource();
        let extensions = Record::default();

        let result = evm.sign_payment(&req, &resource, &extensions).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            matches!(err, EvmSigningError::MissingEip712Domain),
            "expected MissingEip712Domain, got: {err:?}"
        );
    }
}

// ======================== SVM Tests ========================

#[cfg(feature = "svm")]
mod svm_tests {
    use super::*;
    use solana_pubkey::Pubkey;
    use std::str::FromStr;
    use x402_networks::svm::SvmAddress;
    use x402_signer::svm::transaction::{
        TransactionParams, build_exact_svm_transaction, derive_ata,
    };
    use x402_signer::svm::{SvmPaymentSigner, SvmRpc};

    #[test]
    fn derive_ata_deterministic() {
        let owner = Pubkey::from_str("GVmFbJa2MWLBkk2s9Y4M5hFTdQ41QRNfzZWMg2F3udz").unwrap();
        let mint = Pubkey::from_str("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").unwrap();
        let token_program =
            Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap();

        let ata1 = derive_ata(&owner, &mint, &token_program);
        let ata2 = derive_ata(&owner, &mint, &token_program);

        assert_eq!(ata1, ata2, "ATA derivation should be deterministic");
        // ATA should be a valid off-curve address (PDA)
        assert_ne!(ata1, owner, "ATA should differ from owner");
    }

    #[test]
    fn build_transaction_has_4_instructions() {
        let fee_payer = Pubkey::new_unique();
        let payer = Pubkey::new_unique();
        let mint = Pubkey::from_str("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").unwrap();
        let destination_owner = Pubkey::new_unique();
        let token_program =
            Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap();
        let recent_blockhash = solana_hash::Hash::new_unique();

        let tx = build_exact_svm_transaction(&TransactionParams {
            fee_payer,
            payer,
            mint,
            destination_owner,
            amount: 1_000_000,
            decimals: 6,
            token_program,
            recent_blockhash,
        });

        assert_eq!(tx.message.instructions.len(), 4, "expected 4 instructions");
        // Fee payer should be first account key
        assert_eq!(tx.message.account_keys[0], fee_payer);
        // Signatures should be pre-allocated
        assert!(
            tx.signatures.len() >= 2,
            "expected at least 2 signature slots"
        );
    }

    #[test]
    fn build_transaction_instruction_data() {
        let fee_payer = Pubkey::new_unique();
        let payer = Pubkey::new_unique();
        let mint = Pubkey::from_str("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").unwrap();
        let destination_owner = Pubkey::new_unique();
        let token_program =
            Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap();

        let tx = build_exact_svm_transaction(&TransactionParams {
            fee_payer,
            payer,
            mint,
            destination_owner,
            amount: 1_000_000,
            decimals: 6,
            token_program,
            recent_blockhash: solana_hash::Hash::new_unique(),
        });

        // Instruction 0: SetComputeUnitLimit — disc 2, u32 LE
        let ix0_data = &tx.message.instructions[0].data;
        assert_eq!(ix0_data[0], 2, "SetComputeUnitLimit discriminator");

        // Instruction 1: SetComputeUnitPrice — disc 3, u64 LE
        let ix1_data = &tx.message.instructions[1].data;
        assert_eq!(ix1_data[0], 3, "SetComputeUnitPrice discriminator");

        // Instruction 2: TransferChecked — disc 12, u64 amount, u8 decimals
        let ix2_data = &tx.message.instructions[2].data;
        assert_eq!(ix2_data[0], 12, "TransferChecked discriminator");
        let amount_bytes: [u8; 8] = ix2_data[1..9].try_into().unwrap();
        assert_eq!(u64::from_le_bytes(amount_bytes), 1_000_000);
        assert_eq!(ix2_data[9], 6, "decimals");

        // Instruction 3: Memo — random hex nonce
        let ix3_data = &tx.message.instructions[3].data;
        assert_eq!(
            ix3_data.len(),
            32,
            "memo should be 32 hex chars (16 bytes → hex)"
        );
    }

    // Mock RPC for testing
    struct MockRpc;

    impl SvmRpc for MockRpc {
        type Error = std::io::Error;

        async fn get_latest_blockhash(&self) -> Result<solana_hash::Hash, Self::Error> {
            Ok(solana_hash::Hash::new_unique())
        }

        async fn fetch_mint_info(
            &self,
            _mint: SvmAddress,
        ) -> Result<x402_signer::svm::types::MintInfo, Self::Error> {
            Ok(x402_signer::svm::types::MintInfo {
                program_address: SvmAddress(
                    Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap(),
                ),
                decimals: 6,
            })
        }
    }

    #[test]
    fn svm_signer_matches_solana() {
        let keypair = solana_keypair::Keypair::new();
        let signer = SvmPaymentSigner::new(keypair, MockRpc);

        let req = PaymentRequirements {
            scheme: "exact".into(),
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp".into(),
            amount: AmountValue(1_000_000),
            asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".into(),
            pay_to: "GVmFbJa2MWLBkk2s9Y4M5hFTdQ41QRNfzZWMg2F3udz".into(),
            max_timeout_seconds: 300,
            extra: Some(json!({
                "feePayer": "GVmFbJa2MWLBkk2s9Y4M5hFTdQ41QRNfzZWMg2F3udz"
            })),
        };
        assert!(signer.matches(&req));
    }

    #[test]
    fn svm_signer_rejects_evm() {
        let keypair = solana_keypair::Keypair::new();
        let signer = SvmPaymentSigner::new(keypair, MockRpc);

        let req = PaymentRequirements {
            scheme: "exact".into(),
            network: "eip155:84532".into(),
            amount: AmountValue(100_000),
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".into(),
            pay_to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF".into(),
            max_timeout_seconds: 300,
            extra: None,
        };
        assert!(!signer.matches(&req));
    }

    #[tokio::test]
    async fn svm_sign_payment() {
        let keypair = solana_keypair::Keypair::new();
        let signer = SvmPaymentSigner::new(keypair, MockRpc);

        let req = PaymentRequirements {
            scheme: "exact".into(),
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp".into(),
            amount: AmountValue(1_000_000),
            asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".into(),
            pay_to: "GVmFbJa2MWLBkk2s9Y4M5hFTdQ41QRNfzZWMg2F3udz".into(),
            max_timeout_seconds: 300,
            extra: Some(json!({
                "feePayer": "GVmFbJa2MWLBkk2s9Y4M5hFTdQ41QRNfzZWMg2F3udz"
            })),
        };
        let resource = test_resource();
        let extensions = Record::default();

        let result = signer.sign_payment(&req, &resource, &extensions).await;
        assert!(result.is_ok(), "SVM signing failed: {:?}", result.err());

        let payload = result.unwrap();
        assert_eq!(payload.x402_version, X402V2);
        // Payload should contain base64-encoded transaction
        let tx_field = payload.payload.get("transaction");
        assert!(tx_field.is_some(), "missing transaction field");
        let tx_b64 = tx_field.unwrap().as_str().unwrap();
        assert!(!tx_b64.is_empty(), "transaction should not be empty");

        // Should be valid base64
        use base64::{Engine, prelude::BASE64_STANDARD};
        let decoded = BASE64_STANDARD.decode(tx_b64);
        assert!(decoded.is_ok(), "transaction should be valid base64");
    }
}

// ======================== Client Tests ========================

#[cfg(feature = "evm")]
mod client_tests {
    use super::*;
    use alloy::signers::local::PrivateKeySigner;
    use x402_signer::{X402Client, evm::EvmPaymentSigner};

    #[tokio::test]
    async fn client_selects_and_signs() {
        let signer = PrivateKeySigner::random();
        let evm = EvmPaymentSigner::new(signer);
        let client = X402Client::new(evm);

        let payment_required = PaymentRequired {
            x402_version: X402V2,
            error: "Payment Required".into(),
            resource: test_resource(),
            accepts: Accepts::from(PaymentRequirements {
                scheme: "exact".into(),
                network: "eip155:84532".into(),
                amount: AmountValue(100_000),
                asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".into(),
                pay_to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF".into(),
                max_timeout_seconds: 300,
                extra: Some(json!({
                    "name": "USD Coin",
                    "version": "2"
                })),
            }),
            extensions: Record::default(),
        };

        let result = client.create_payment(&payment_required).await;
        assert!(result.is_ok(), "client payment failed: {:?}", result.err());

        let payload = result.unwrap();
        assert_eq!(payload.x402_version, X402V2);
        assert!(payload.payload.get("signature").is_some());
    }

    #[tokio::test]
    async fn client_rejects_unsupported_network() {
        let signer = PrivateKeySigner::random();
        let evm = EvmPaymentSigner::new(signer);
        let client = X402Client::new(evm);

        // Only SVM requirements — EVM signer can't handle
        let payment_required = PaymentRequired {
            x402_version: X402V2,
            error: "Payment Required".into(),
            resource: test_resource(),
            accepts: Accepts::from(PaymentRequirements {
                scheme: "exact".into(),
                network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp".into(),
                amount: AmountValue(1_000_000),
                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".into(),
                pay_to: "GVmFbJa2MWLBkk2s9Y4M5hFTdQ41QRNfzZWMg2F3udz".into(),
                max_timeout_seconds: 300,
                extra: None,
            }),
            extensions: Record::default(),
        };

        let result = client.create_payment(&payment_required).await;
        assert!(result.is_err(), "should reject unsupported network");
    }
}
