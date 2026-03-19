use solana_hash::Hash;
use solana_instruction::{AccountMeta, Instruction};
use solana_message::Message;
use solana_pubkey::Pubkey;
use solana_transaction::Transaction;

use super::constants::*;

/// Parameters for building an exact SVM payment transaction.
pub struct TransactionParams {
    /// The facilitator's address (pays gas fees).
    pub fee_payer: Pubkey,
    /// The buyer's address (token authority).
    pub payer: Pubkey,
    /// The token mint address.
    pub mint: Pubkey,
    /// Destination wallet (pay_to).
    pub destination_owner: Pubkey,
    /// Amount in smallest token units.
    pub amount: u64,
    /// Token decimals.
    pub decimals: u8,
    /// Token program (SPL Token or Token-2022).
    pub token_program: Pubkey,
    /// Recent blockhash for the transaction.
    pub recent_blockhash: Hash,
}

/// Build an exact SVM payment transaction.
///
/// Instruction layout:
/// 0. SetComputeUnitLimit
/// 1. SetComputeUnitPrice
/// 2. TransferChecked (source ATA → destination ATA)
/// 3. Memo (random nonce)
///
/// The transaction is unsigned. Caller must partially sign with the buyer's key.
pub fn build_exact_svm_transaction(params: &TransactionParams) -> Transaction {
    let source_ata = derive_ata(&params.payer, &params.mint, &params.token_program);
    let destination_ata = derive_ata(
        &params.destination_owner,
        &params.mint,
        &params.token_program,
    );

    let instructions = vec![
        build_set_compute_unit_limit(DEFAULT_COMPUTE_UNIT_LIMIT),
        build_set_compute_unit_price(DEFAULT_COMPUTE_UNIT_PRICE),
        build_transfer_checked(
            &source_ata,
            &params.mint,
            &destination_ata,
            &params.payer,
            params.amount,
            params.decimals,
            &params.token_program,
        ),
        build_memo_instruction(),
    ];

    let message = Message::new_with_blockhash(
        &instructions,
        Some(&params.fee_payer),
        &params.recent_blockhash,
    );

    Transaction::new_unsigned(message)
}

/// Derive the Associated Token Account address.
pub fn derive_ata(owner: &Pubkey, mint: &Pubkey, token_program: &Pubkey) -> Pubkey {
    let (ata, _bump) = Pubkey::find_program_address(
        &[owner.as_ref(), token_program.as_ref(), mint.as_ref()],
        &ASSOCIATED_TOKEN_PROGRAM,
    );
    ata
}

/// ComputeBudget: SetComputeUnitLimit instruction.
pub(crate) fn build_set_compute_unit_limit(units: u32) -> Instruction {
    // Discriminator 2 + u32 LE
    let mut data = Vec::with_capacity(5);
    data.push(2u8);
    data.extend_from_slice(&units.to_le_bytes());

    Instruction {
        program_id: COMPUTE_BUDGET_PROGRAM,
        accounts: vec![],
        data,
    }
}

/// ComputeBudget: SetComputeUnitPrice instruction.
pub(crate) fn build_set_compute_unit_price(micro_lamports: u64) -> Instruction {
    // Discriminator 3 + u64 LE
    let mut data = Vec::with_capacity(9);
    data.push(3u8);
    data.extend_from_slice(&micro_lamports.to_le_bytes());

    Instruction {
        program_id: COMPUTE_BUDGET_PROGRAM,
        accounts: vec![],
        data,
    }
}

/// SPL Token: TransferChecked instruction.
pub(crate) fn build_transfer_checked(
    source: &Pubkey,
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
    amount: u64,
    decimals: u8,
    token_program: &Pubkey,
) -> Instruction {
    // Discriminator 12 + u64 LE amount + u8 decimals = 10 bytes
    let mut data = Vec::with_capacity(10);
    data.push(12u8);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*source, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*authority, true),
        ],
        data,
    }
}

/// Memo program instruction with a random hex nonce.
pub(crate) fn build_memo_instruction() -> Instruction {
    let nonce: [u8; 16] = rand::random();
    let hex_str = hex::encode(nonce);

    Instruction {
        program_id: MEMO_PROGRAM,
        accounts: vec![],
        data: hex_str.into_bytes(),
    }
}
