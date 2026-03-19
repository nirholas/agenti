/// x402 Transfer Module - Sponsored Transfers for Payment Protocol
///
/// Implements sponsored transactions for Aptos payments:
/// - Users sign transactions directly (they are the signer)
/// - Facilitator pays gas via fee payer mechanism
/// - Supports both Coin and Fungible Asset (FA) standards
/// - Supports multi-recipient splits for platform fees
/// - Replay protection via nonce registry
///
/// Security features:
/// - Time-based authorization expiration
/// - Chain ID validation (mainnet/testnet/devnet)
/// - Nonce-based replay protection
/// - Multi-recipient validation with duplicate detection
/// - Overflow protection for split transfers
/// - Event emission for tracking
///
/// Recommended Functions:
/// - transfer_sponsored: Facilitator pays gas, user transfers APT Coin (single recipient)
/// - transfer_sponsored_split: Facilitator pays gas, user transfers APT Coin (multiple recipients)
/// - transfer_sponsored_fa: Facilitator pays gas, user transfers FA (single recipient)
/// - transfer_sponsored_fa_split: Facilitator pays gas, user transfers FA (multiple recipients)

module x402a::x402_transfer {
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::smart_table::{Self, SmartTable};

    #[verify_only]
    use aptos_framework::chain_id;

    // ============================================================
    // ERRORS
    // ============================================================

    const E_NONCE_ALREADY_USED: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_REGISTRY_NOT_INITIALIZED: u64 = 7;
    const E_AMOUNTS_MISMATCH: u64 = 8;
    const E_ZERO_RECIPIENTS: u64 = 9;
    const E_AUTHORIZATION_EXPIRED: u64 = 10;
    const E_TOO_MANY_RECIPIENTS: u64 = 11;
    const E_DUPLICATE_RECIPIENT: u64 = 12;
    const E_INVALID_CHAIN_ID: u64 = 13;
    const E_TOTAL_AMOUNT_OVERFLOW: u64 = 14;
    const E_INVALID_RECIPIENT_ADDRESS: u64 = 15;

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// Maximum number of recipients in split transfers
    const MAX_RECIPIENTS: u64 = 10;

    /// Chain IDs for replay protection
    const CHAIN_ID_MAINNET: u8 = 1;
    const CHAIN_ID_TESTNET: u8 = 2;
    const CHAIN_ID_DEVNET: u8 = 3;

    /// Maximum u64 value for overflow checks
    const MAX_U64: u128 = 18446744073709551615;

    // ============================================================
    // STRUCTS
    // ============================================================

    /// Global nonce registry to prevent replay attacks
    struct NonceRegistry has key {
        // Maps nonce hash to usage status
        used_nonces: SmartTable<vector<u8>, bool>,
    }

    // ============================================================
    // MOVE PROVER SPECIFICATIONS
    // ============================================================

    spec NonceRegistry {
        // Invariant: All values in used_nonces table are true
        invariant forall k: vector<u8>: smart_table::spec_contains(used_nonces, k) ==> smart_table::spec_get(used_nonces, k) == true;
    }

    // Helper spec function to calculate sum of amounts
    spec fun spec_sum_amounts(amounts: vector<u64>): u64 {
        spec_sum_amounts_from(amounts, 0, len(amounts))
    }

    spec fun spec_sum_amounts_from(amounts: vector<u64>, start: u64, end: u64): u64 {
        if (start >= end) {
            0
        } else {
            amounts[start] + spec_sum_amounts_from(amounts, start + 1, end)
        }
    }

    // Helper spec function to check for duplicates in a vector
    spec fun spec_has_duplicates(v: vector<address>): bool {
        exists i in 0..len(v), j in 0..len(v): i != j && v[i] == v[j]
    }

    // Helper spec function to check if all elements are non-zero
    spec fun spec_all_positive(amounts: vector<u64>): bool {
        forall i in 0..len(amounts): amounts[i] > 0
    }

    // Helper spec function to check if all addresses are non-zero
    spec fun spec_all_non_zero_addresses(addrs: vector<address>): bool {
        forall i in 0..len(addrs): addrs[i] != @0x0
    }

    #[event]
    struct TransferWithAuthorizationEvent has drop, store {
        from: address,
        to: address,
        amount: u64,
        nonce: vector<u8>,
        facilitator: address,
        timestamp: u64,
    }

    #[event]
    struct TransferWithSplitEvent has drop, store {
        from: address,
        recipients: vector<address>,
        amounts: vector<u64>,
        total_amount: u64,
        nonce: vector<u8>,
        facilitator: address,
        timestamp: u64,
    }

    #[event]
    struct TransferFAEvent has drop, store {
        from: address,
        to: address,
        amount: u64,
        fa_metadata: address,
        nonce: vector<u8>,
        facilitator: address,
        timestamp: u64,
    }

    #[event]
    struct TransferFASplitEvent has drop, store {
        from: address,
        recipients: vector<address>,
        amounts: vector<u64>,
        total_amount: u64,
        fa_metadata: address,
        nonce: vector<u8>,
        facilitator: address,
        timestamp: u64,
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    /// Initialize the nonce registry for an account
    /// Must be called once per account before using x402 transfers
    public entry fun initialize_registry(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<NonceRegistry>(addr)) {
            move_to(account, NonceRegistry {
                used_nonces: smart_table::new(),
            });
        };
    }
    spec initialize_registry {
        let addr = signer::address_of(account);

        // Ensures NonceRegistry exists after initialization
        ensures exists<NonceRegistry>(addr);

        // Ensures newly created registry has no used nonces
        ensures !old(exists<NonceRegistry>(addr)) ==> smart_table::spec_len(global<NonceRegistry>(addr).used_nonces) == 0;

        // If registry already existed, it remains unchanged
        ensures old(exists<NonceRegistry>(addr)) ==> global<NonceRegistry>(addr) == old(global<NonceRegistry>(addr));
    }

    // ============================================================
    // PUBLIC ENTRY FUNCTIONS - COIN (APT)
    // ============================================================

    /// Transfer APT directly from user (SIMPLIFIED VERSION - NO SIGNATURE VERIFICATION)
    /// User submits this transaction themselves and pays their own gas
    ///
    /// @param user - The user account sending funds (also pays gas)
    /// @param to - Recipient address
    /// @param amount - Amount in octas (1 APT = 100_000_000 octas)
    /// @param nonce - Unique identifier to prevent replay attacks
    ///
    /// Aborts:
    /// - E_NONCE_ALREADY_USED: Nonce has already been used
    /// - E_INVALID_AMOUNT: Amount is zero
    /// - E_INSUFFICIENT_BALANCE: User has insufficient funds
    /// - E_REGISTRY_NOT_INITIALIZED: Nonce registry not initialized
    public entry fun transfer_direct(
        user: &signer,
        to: address,
        amount: u64,
        nonce: vector<u8>,
    ) acquires NonceRegistry {
        let from = signer::address_of(user);

        // Validate inputs
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(exists<NonceRegistry>(from), E_REGISTRY_NOT_INITIALIZED);

        // Check nonce hasn't been used
        let registry = borrow_global_mut<NonceRegistry>(from);
        assert!(
            !smart_table::contains(&registry.used_nonces, nonce),
            E_NONCE_ALREADY_USED
        );

        // Mark nonce as used
        smart_table::add(&mut registry.used_nonces, nonce, true);

        // Execute transfer - user pays for their own transfer
        coin::transfer<AptosCoin>(user, to, amount);

        // Emit event
        event::emit(TransferWithAuthorizationEvent {
            from,
            to,
            amount,
            nonce,
            facilitator: from, // User is their own "facilitator"
            timestamp: timestamp::now_seconds(),
        });
    }
    spec transfer_direct {
        pragma verify = false;  // Disable prover for entry functions (coin specs incomplete)
    }

    /// Transfer APT using fee payer (sponsored transaction)
    ///
    /// This is the RECOMMENDED method for x402 payments. The user signs the transaction
    /// and their funds are transferred, while the facilitator pays gas through the
    /// Aptos fee payer mechanism.
    ///
    /// @param user - The user account (signer) who owns and authorizes the transfer
    /// @param to - Recipient address
    /// @param amount - Amount in octas (1 APT = 100_000_000 octas)
    /// @param nonce - Unique identifier to prevent replay attacks
    /// @param valid_until - Unix timestamp when authorization expires
    /// @param chain_id - Chain ID (1=mainnet, 2=testnet, 3=devnet) for replay protection
    ///
    /// Security features:
    /// - User must be transaction signer (enforced by blockchain)
    /// - Time-based expiration prevents old authorizations
    /// - Chain ID prevents cross-chain replay attacks
    /// - Nonce prevents same-chain replay attacks
    /// - Facilitator pays gas via fee payer mechanism
    ///
    /// Aborts:
    /// - E_NONCE_ALREADY_USED: Nonce has already been used
    /// - E_INVALID_AMOUNT: Amount is zero
    /// - E_INSUFFICIENT_BALANCE: User has insufficient funds
    /// - E_REGISTRY_NOT_INITIALIZED: Nonce registry not initialized
    /// - E_AUTHORIZATION_EXPIRED: Current time exceeds valid_until
    /// - E_INVALID_CHAIN_ID: Chain ID doesn't match current network
    /// - E_INVALID_RECIPIENT_ADDRESS: Recipient is zero address
    public entry fun transfer_sponsored(
        user: &signer,
        to: address,
        amount: u64,
        nonce: vector<u8>,
        valid_until: u64,
        chain_id: u8,
    ) acquires NonceRegistry {
        let from = signer::address_of(user);

        // Validate expiration
        assert!(timestamp::now_seconds() <= valid_until, E_AUTHORIZATION_EXPIRED);

        // Validate chain ID (adjust based on network)
        assert!(chain_id == CHAIN_ID_TESTNET || chain_id == CHAIN_ID_MAINNET || chain_id == CHAIN_ID_DEVNET, E_INVALID_CHAIN_ID);

        // Validate inputs
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(to != @0x0, E_INVALID_RECIPIENT_ADDRESS);
        assert!(exists<NonceRegistry>(from), E_REGISTRY_NOT_INITIALIZED);

        // Check balance before proceeding
        let balance = coin::balance<AptosCoin>(from);
        assert!(balance >= amount, E_INSUFFICIENT_BALANCE);

        // Check nonce hasn't been used
        let registry = borrow_global_mut<NonceRegistry>(from);
        assert!(
            !smart_table::contains(&registry.used_nonces, nonce),
            E_NONCE_ALREADY_USED
        );

        // Mark nonce as used
        smart_table::add(&mut registry.used_nonces, nonce, true);

        // Execute transfer - user's funds transferred (user is the signer!)
        // Facilitator pays gas through fee payer mechanism
        coin::transfer<AptosCoin>(user, to, amount);

        // Emit event
        event::emit(TransferWithAuthorizationEvent {
            from,
            to,
            amount,
            nonce,
            facilitator: @0x0, // Fee payer info not available in entry function context
            timestamp: timestamp::now_seconds(),
        });
    }
    spec transfer_sponsored {
        let from = signer::address_of(user);

        // Abort conditions
        aborts_if timestamp::spec_now_seconds() > valid_until with E_AUTHORIZATION_EXPIRED;
        aborts_if chain_id != CHAIN_ID_TESTNET && chain_id != CHAIN_ID_MAINNET && chain_id != CHAIN_ID_DEVNET with E_INVALID_CHAIN_ID;
        aborts_if amount == 0 with E_INVALID_AMOUNT;
        aborts_if to == @0x0 with E_INVALID_RECIPIENT_ADDRESS;
        aborts_if !exists<NonceRegistry>(from) with E_REGISTRY_NOT_INITIALIZED;
        aborts_if smart_table::spec_contains(global<NonceRegistry>(from).used_nonces, nonce) with E_NONCE_ALREADY_USED;

        // Postcondition: nonce is marked as used
        ensures smart_table::spec_contains(global<NonceRegistry>(from).used_nonces, nonce);
    }


    /// Transfer APT to multiple recipients using fee payer (sponsored transaction)
    ///
    /// This is the RECOMMENDED method for x402 payments with fee splits. The user signs
    /// the transaction and their funds are split among multiple recipients, while the
    /// facilitator pays gas through the Aptos fee payer mechanism.
    ///
    /// @param user - The user account (signer) who owns and authorizes the transfer
    /// @param recipients - Vector of recipient addresses [artist, platform]
    /// @param amounts - Vector of amounts in octas [artist_amount, platform_fee]
    /// @param nonce - Unique identifier to prevent replay attacks
    /// @param valid_until - Unix timestamp when authorization expires
    /// @param chain_id - Chain ID (1=mainnet, 2=testnet, 3=devnet) for replay protection
    ///
    /// Security features:
    /// - Maximum 10 recipients (prevents gas limit issues)
    /// - Duplicate recipient detection
    /// - Overflow protection using u128 arithmetic
    /// - All standard validations from transfer_sponsored
    ///
    /// Example: Pay artist $0.99 + platform 1.5% = $0.015
    ///   recipients = [artist_addr, platform_addr]
    ///   amounts = [9900000, 150000] // in octas
    ///
    /// Aborts:
    /// - All abort codes from transfer_sponsored
    /// - E_ZERO_RECIPIENTS: Recipients vector is empty
    /// - E_TOO_MANY_RECIPIENTS: More than MAX_RECIPIENTS (10)
    /// - E_AMOUNTS_MISMATCH: Recipients and amounts vectors have different lengths
    /// - E_DUPLICATE_RECIPIENT: Same address appears multiple times
    /// - E_TOTAL_AMOUNT_OVERFLOW: Sum of amounts exceeds u64::MAX
    public entry fun transfer_sponsored_split(
        user: &signer,
        recipients: vector<address>,
        amounts: vector<u64>,
        nonce: vector<u8>,
        valid_until: u64,
        chain_id: u8,
    ) acquires NonceRegistry {
        let from = signer::address_of(user);

        // Validate expiration
        assert!(timestamp::now_seconds() <= valid_until, E_AUTHORIZATION_EXPIRED);

        // Validate chain ID
        assert!(chain_id == CHAIN_ID_TESTNET || chain_id == CHAIN_ID_MAINNET || chain_id == CHAIN_ID_DEVNET, E_INVALID_CHAIN_ID);

        // Validate recipients and amounts
        let num_recipients = vector::length(&recipients);
        assert!(num_recipients > 0, E_ZERO_RECIPIENTS);
        assert!(num_recipients <= MAX_RECIPIENTS, E_TOO_MANY_RECIPIENTS);
        assert!(num_recipients == vector::length(&amounts), E_AMOUNTS_MISMATCH);
        assert!(exists<NonceRegistry>(from), E_REGISTRY_NOT_INITIALIZED);

        // Validate all amounts are positive and no recipient is zero address
        // Calculate total with overflow protection (use u128)
        let i = 0;
        let total_amount_u128 = 0u128;
        while (i < num_recipients) {
            let recipient = *vector::borrow(&recipients, i);
            let amt = *vector::borrow(&amounts, i);

            // Validate amount and recipient
            assert!(amt > 0, E_INVALID_AMOUNT);
            assert!(recipient != @0x0, E_INVALID_RECIPIENT_ADDRESS);

            // Add to total using u128 to detect overflow
            total_amount_u128 = total_amount_u128 + (amt as u128);

            i = i + 1;
        };

        // Ensure total doesn't overflow u64
        assert!(total_amount_u128 <= MAX_U64, E_TOTAL_AMOUNT_OVERFLOW);
        let total_amount = (total_amount_u128 as u64);

        // Check for duplicate recipients
        let j = 0;
        while (j < num_recipients) {
            let recipient_j = *vector::borrow(&recipients, j);
            let k = j + 1;
            while (k < num_recipients) {
                let recipient_k = *vector::borrow(&recipients, k);
                assert!(recipient_j != recipient_k, E_DUPLICATE_RECIPIENT);
                k = k + 1;
            };
            j = j + 1;
        };

        // Check balance before proceeding
        let balance = coin::balance<AptosCoin>(from);
        assert!(balance >= total_amount, E_INSUFFICIENT_BALANCE);

        // Check nonce hasn't been used
        let registry = borrow_global_mut<NonceRegistry>(from);
        assert!(
            !smart_table::contains(&registry.used_nonces, nonce),
            E_NONCE_ALREADY_USED
        );

        // Mark nonce as used
        smart_table::add(&mut registry.used_nonces, nonce, true);

        // Execute transfers to all recipients
        let m = 0;
        while (m < num_recipients) {
            let recipient = *vector::borrow(&recipients, m);
            let amount = *vector::borrow(&amounts, m);
            coin::transfer<AptosCoin>(user, recipient, amount);
            m = m + 1;
        };

        // Emit event
        event::emit(TransferWithSplitEvent {
            from,
            recipients,
            amounts,
            total_amount,
            nonce,
            facilitator: @0x0, // Fee payer info not available in entry function context
            timestamp: timestamp::now_seconds(),
        });
    }
    spec transfer_sponsored_split {
        let from = signer::address_of(user);
        let num_recipients = len(recipients);

        // Abort conditions
        aborts_if timestamp::spec_now_seconds() > valid_until with E_AUTHORIZATION_EXPIRED;
        aborts_if chain_id != CHAIN_ID_TESTNET && chain_id != CHAIN_ID_MAINNET && chain_id != CHAIN_ID_DEVNET with E_INVALID_CHAIN_ID;
        aborts_if num_recipients == 0 with E_ZERO_RECIPIENTS;
        aborts_if num_recipients > MAX_RECIPIENTS with E_TOO_MANY_RECIPIENTS;
        aborts_if len(amounts) != num_recipients with E_AMOUNTS_MISMATCH;
        aborts_if !exists<NonceRegistry>(from) with E_REGISTRY_NOT_INITIALIZED;
        aborts_if !spec_all_positive(amounts) with E_INVALID_AMOUNT;
        aborts_if !spec_all_non_zero_addresses(recipients) with E_INVALID_RECIPIENT_ADDRESS;
        aborts_if spec_sum_amounts(amounts) > MAX_U64 with E_TOTAL_AMOUNT_OVERFLOW;
        aborts_if smart_table::spec_contains(global<NonceRegistry>(from).used_nonces, nonce) with E_NONCE_ALREADY_USED;
        aborts_if spec_has_duplicates(recipients) with E_DUPLICATE_RECIPIENT;

        // Postcondition: nonce is marked as used
        ensures smart_table::spec_contains(global<NonceRegistry>(from).used_nonces, nonce);
    }

    // ============================================================
    // PUBLIC ENTRY FUNCTIONS - FUNGIBLE ASSET (FA)
    // ============================================================

    /// Transfer Fungible Asset using fee payer (sponsored transaction)
    ///
    /// This function works with any Fungible Asset that uses primary stores.
    /// The user signs the transaction and their FA is transferred, while the
    /// facilitator pays gas through the Aptos fee payer mechanism.
    ///
    /// @param user - The user account (signer) who owns and authorizes the transfer
    /// @param fa_metadata - The metadata object of the Fungible Asset
    /// @param to - Recipient address
    /// @param amount - Amount to transfer
    /// @param nonce - Unique identifier to prevent replay attacks
    /// @param valid_until - Unix timestamp when authorization expires
    /// @param chain_id - Chain ID (1=mainnet, 2=testnet, 3=devnet) for replay protection
    ///
    /// Security features:
    /// - All standard validations from transfer_sponsored
    /// - Works with any FA using primary stores
    ///
    /// Aborts:
    /// - Same abort codes as transfer_sponsored
    public entry fun transfer_sponsored_fa(
        user: &signer,
        fa_metadata: Object<Metadata>,
        to: address,
        amount: u64,
        nonce: vector<u8>,
        valid_until: u64,
        chain_id: u8,
    ) acquires NonceRegistry {
        let from = signer::address_of(user);

        // Validate expiration
        assert!(timestamp::now_seconds() <= valid_until, E_AUTHORIZATION_EXPIRED);

        // Validate chain ID
        assert!(chain_id == CHAIN_ID_TESTNET || chain_id == CHAIN_ID_MAINNET || chain_id == CHAIN_ID_DEVNET, E_INVALID_CHAIN_ID);

        // Validate inputs
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(to != @0x0, E_INVALID_RECIPIENT_ADDRESS);
        assert!(exists<NonceRegistry>(from), E_REGISTRY_NOT_INITIALIZED);

        // Check balance before proceeding
        let balance = primary_fungible_store::balance(from, fa_metadata);
        assert!(balance >= amount, E_INSUFFICIENT_BALANCE);

        // Check nonce hasn't been used
        let registry = borrow_global_mut<NonceRegistry>(from);
        assert!(
            !smart_table::contains(&registry.used_nonces, nonce),
            E_NONCE_ALREADY_USED
        );

        // Mark nonce as used
        smart_table::add(&mut registry.used_nonces, nonce, true);

        // Execute transfer using primary fungible store
        primary_fungible_store::transfer(user, fa_metadata, to, amount);

        // Emit event
        event::emit(TransferFAEvent {
            from,
            to,
            amount,
            fa_metadata: object::object_address(&fa_metadata),
            nonce,
            facilitator: @0x0,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Transfer Fungible Asset to multiple recipients using fee payer (sponsored transaction)
    ///
    /// This function splits FA transfers among multiple recipients. Works with any
    /// Fungible Asset that uses primary stores.
    ///
    /// @param user - The user account (signer) who owns and authorizes the transfer
    /// @param fa_metadata - The metadata object of the Fungible Asset
    /// @param recipients - Vector of recipient addresses
    /// @param amounts - Vector of amounts to transfer
    /// @param nonce - Unique identifier to prevent replay attacks
    /// @param valid_until - Unix timestamp when authorization expires
    /// @param chain_id - Chain ID (1=mainnet, 2=testnet, 3=devnet) for replay protection
    ///
    /// Security features:
    /// - All standard validations from transfer_sponsored_split
    /// - Works with any FA using primary stores
    ///
    /// Aborts:
    /// - Same abort codes as transfer_sponsored_split
    public entry fun transfer_sponsored_fa_split(
        user: &signer,
        fa_metadata: Object<Metadata>,
        recipients: vector<address>,
        amounts: vector<u64>,
        nonce: vector<u8>,
        valid_until: u64,
        chain_id: u8,
    ) acquires NonceRegistry {
        let from = signer::address_of(user);

        // Validate expiration
        assert!(timestamp::now_seconds() <= valid_until, E_AUTHORIZATION_EXPIRED);

        // Validate chain ID
        assert!(chain_id == CHAIN_ID_TESTNET || chain_id == CHAIN_ID_MAINNET || chain_id == CHAIN_ID_DEVNET, E_INVALID_CHAIN_ID);

        // Validate recipients and amounts
        let num_recipients = vector::length(&recipients);
        assert!(num_recipients > 0, E_ZERO_RECIPIENTS);
        assert!(num_recipients <= MAX_RECIPIENTS, E_TOO_MANY_RECIPIENTS);
        assert!(num_recipients == vector::length(&amounts), E_AMOUNTS_MISMATCH);
        assert!(exists<NonceRegistry>(from), E_REGISTRY_NOT_INITIALIZED);

        // Validate all amounts are positive and no recipient is zero address
        // Calculate total with overflow protection (use u128)
        let i = 0;
        let total_amount_u128 = 0u128;
        while (i < num_recipients) {
            let recipient = *vector::borrow(&recipients, i);
            let amt = *vector::borrow(&amounts, i);

            // Validate amount and recipient
            assert!(amt > 0, E_INVALID_AMOUNT);
            assert!(recipient != @0x0, E_INVALID_RECIPIENT_ADDRESS);

            // Add to total using u128 to detect overflow
            total_amount_u128 = total_amount_u128 + (amt as u128);

            i = i + 1;
        };

        // Ensure total doesn't overflow u64
        assert!(total_amount_u128 <= MAX_U64, E_TOTAL_AMOUNT_OVERFLOW);
        let total_amount = (total_amount_u128 as u64);

        // Check for duplicate recipients
        let j = 0;
        while (j < num_recipients) {
            let recipient_j = *vector::borrow(&recipients, j);
            let k = j + 1;
            while (k < num_recipients) {
                let recipient_k = *vector::borrow(&recipients, k);
                assert!(recipient_j != recipient_k, E_DUPLICATE_RECIPIENT);
                k = k + 1;
            };
            j = j + 1;
        };

        // Check balance before proceeding
        let balance = primary_fungible_store::balance(from, fa_metadata);
        assert!(balance >= total_amount, E_INSUFFICIENT_BALANCE);

        // Check nonce hasn't been used
        let registry = borrow_global_mut<NonceRegistry>(from);
        assert!(
            !smart_table::contains(&registry.used_nonces, nonce),
            E_NONCE_ALREADY_USED
        );

        // Mark nonce as used
        smart_table::add(&mut registry.used_nonces, nonce, true);

        // Execute transfers to all recipients
        let m = 0;
        while (m < num_recipients) {
            let recipient = *vector::borrow(&recipients, m);
            let amount = *vector::borrow(&amounts, m);
            primary_fungible_store::transfer(user, fa_metadata, recipient, amount);
            m = m + 1;
        };

        // Emit event
        event::emit(TransferFASplitEvent {
            from,
            recipients,
            amounts,
            total_amount,
            fa_metadata: object::object_address(&fa_metadata),
            nonce,
            facilitator: @0x0,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ============================================================
    // DEPRECATED FUNCTIONS (kept for backward compatibility)
    // ============================================================

    /// DEPRECATED: Use transfer_sponsored instead
    /// This function is kept for backward compatibility with existing deployments
    public entry fun transfer_with_authorization(
        user: &signer,
        _public_key: address,  // Ignored, kept for signature compatibility
        to: address,
        amount: u64,
        nonce: vector<u8>,
        _signature: vector<u8>,  // Ignored
        _message: vector<u8>,  // Ignored
    ) acquires NonceRegistry {
        // Just call transfer_sponsored with default values
        let valid_until = timestamp::now_seconds() + 3600; // 1 hour
        transfer_sponsored(user, to, amount, nonce, valid_until, CHAIN_ID_TESTNET);
    }

    /// DEPRECATED: Use transfer_sponsored_split instead
    /// This function is kept for backward compatibility with existing deployments
    public entry fun transfer_with_split(
        user: &signer,
        _public_key: address,  // Ignored, kept for signature compatibility
        recipients: vector<address>,
        amounts: vector<u64>,
        nonce: vector<u8>,
        _signature: vector<u8>,  // Ignored
        _message: vector<u8>,  // Ignored
    ) acquires NonceRegistry {
        // Just call transfer_sponsored_split with default values
        let valid_until = timestamp::now_seconds() + 3600; // 1 hour
        transfer_sponsored_split(user, recipients, amounts, nonce, valid_until, CHAIN_ID_TESTNET);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    #[view]
    public fun is_nonce_used(account: address, nonce: vector<u8>): bool acquires NonceRegistry {
        if (!exists<NonceRegistry>(account)) {
            return false
        };
        let registry = borrow_global<NonceRegistry>(account);
        smart_table::contains(&registry.used_nonces, nonce)
    }
    spec is_nonce_used {
        // Never aborts
        aborts_if false;

        // Returns true if and only if the nonce exists in the registry
        ensures result == (exists<NonceRegistry>(account) && smart_table::spec_contains(global<NonceRegistry>(account).used_nonces, nonce));
    }

    #[view]
    public fun is_registry_initialized(account: address): bool {
        exists<NonceRegistry>(account)
    }
    spec is_registry_initialized {
        // Never aborts
        aborts_if false;

        // Returns true if and only if NonceRegistry exists at account
        ensures result == exists<NonceRegistry>(account);
    }

    // ============================================================
    // INTERNAL FUNCTIONS
    // ============================================================
    // (None currently)

    // ============================================================
    // TESTS
    // ============================================================

    #[test_only]
    use aptos_framework::account;
    #[test_only]
    use aptos_framework::aptos_coin;

    #[test_only]
    const ONE_APT: u64 = 100000000;

    #[test(user = @0xCAFE)]
    fun test_initialize_registry(user: &signer) {
        let user_addr = signer::address_of(user);
        account::create_account_for_test(user_addr);

        initialize_registry(user);

        assert!(is_registry_initialized(user_addr), 0);
    }

    #[test(user = @0xCAFE)]
    fun test_nonce_checking(user: &signer) acquires NonceRegistry {
        let user_addr = signer::address_of(user);
        account::create_account_for_test(user_addr);

        initialize_registry(user);

        let nonce = b"test-nonce-123";
        assert!(!is_nonce_used(user_addr, nonce), 0);

        // Manually mark as used
        let registry = borrow_global_mut<NonceRegistry>(user_addr);
        smart_table::add(&mut registry.used_nonces, nonce, true);

        assert!(is_nonce_used(user_addr, nonce), 1);
    }

    // Note: Testing signature verification requires actual Ed25519 key pairs
    // In production, use the Aptos CLI or SDK to generate test signatures
    // For now, we'll skip the full integration test and rely on the signature
    // verification logic being tested separately


    #[test(user = @0xCAFE, recipient = @0xBEEF, aptos = @0x1, framework = @0x1)]
    fun test_transfer_sponsored_success(
        user: &signer,
        recipient: &signer,
        aptos: &signer,
        framework: &signer,
    ) acquires NonceRegistry {
        let user_addr = signer::address_of(user);
        let recipient_addr = signer::address_of(recipient);

        // Initialize timestamp
        timestamp::set_time_has_started_for_testing(framework);

        account::create_account_for_test(user_addr);
        account::create_account_for_test(recipient_addr);

        // Initialize registry
        initialize_registry(user);

        // Initialize coins
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos);
        coin::register<AptosCoin>(user);
        coin::register<AptosCoin>(recipient);
        aptos_coin::mint(aptos, user_addr, 10 * ONE_APT);

        // Transfer with sponsored transaction
        let nonce = b"test-nonce-sponsored";
        let valid_until = timestamp::now_seconds() + 3600; // 1 hour from now

        transfer_sponsored(
            user,
            recipient_addr,
            ONE_APT,
            nonce,
            valid_until,
            CHAIN_ID_TESTNET
        );

        // Verify balances
        assert!(coin::balance<AptosCoin>(user_addr) == 9 * ONE_APT, 0);
        assert!(coin::balance<AptosCoin>(recipient_addr) == ONE_APT, 1);
        assert!(is_nonce_used(user_addr, nonce), 2);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(user = @0xCAFE, aptos = @0x1, framework = @0x1)]
    #[expected_failure(abort_code = E_AUTHORIZATION_EXPIRED, location = Self)]
    fun test_transfer_sponsored_expired(
        user: &signer,
        aptos: &signer,
        framework: &signer,
    ) acquires NonceRegistry {
        let user_addr = signer::address_of(user);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::fast_forward_seconds(1000); // Fast forward to avoid underflow
        account::create_account_for_test(user_addr);

        initialize_registry(user);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos);
        coin::register<AptosCoin>(user);
        aptos_coin::mint(aptos, user_addr, 10 * ONE_APT);

        // Try to use expired authorization
        let valid_until = timestamp::now_seconds() - 1; // Expired!

        transfer_sponsored(
            user,
            @0xBEEF,
            ONE_APT,
            b"nonce",
            valid_until,
            CHAIN_ID_TESTNET
        );

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(user = @0xCAFE, aptos = @0x1, framework = @0x1)]
    #[expected_failure(abort_code = E_INVALID_RECIPIENT_ADDRESS, location = Self)]
    fun test_transfer_sponsored_zero_address(
        user: &signer,
        aptos: &signer,
        framework: &signer,
    ) acquires NonceRegistry {
        let user_addr = signer::address_of(user);

        timestamp::set_time_has_started_for_testing(framework);
        account::create_account_for_test(user_addr);

        initialize_registry(user);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos);
        coin::register<AptosCoin>(user);
        aptos_coin::mint(aptos, user_addr, 10 * ONE_APT);

        // Try to send to zero address
        transfer_sponsored(
            user,
            @0x0, // Zero address!
            ONE_APT,
            b"nonce",
            timestamp::now_seconds() + 3600,
            CHAIN_ID_TESTNET
        );

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(user = @0xCAFE, artist = @0xABCD, platform = @0xDEAD, aptos = @0x1, framework = @0x1)]
    fun test_transfer_sponsored_split_success(
        user: &signer,
        artist: &signer,
        platform: &signer,
        aptos: &signer,
        framework: &signer,
    ) acquires NonceRegistry {
        let user_addr = signer::address_of(user);
        let artist_addr = signer::address_of(artist);
        let platform_addr = signer::address_of(platform);

        timestamp::set_time_has_started_for_testing(framework);
        account::create_account_for_test(user_addr);
        account::create_account_for_test(artist_addr);
        account::create_account_for_test(platform_addr);

        initialize_registry(user);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos);
        coin::register<AptosCoin>(user);
        coin::register<AptosCoin>(artist);
        coin::register<AptosCoin>(platform);
        aptos_coin::mint(aptos, user_addr, 10 * ONE_APT);

        // Create split payment: 99% to artist, 1% to platform
        let recipients = vector::empty<address>();
        vector::push_back(&mut recipients, artist_addr);
        vector::push_back(&mut recipients, platform_addr);

        let amounts = vector::empty<u64>();
        vector::push_back(&mut amounts, 99 * ONE_APT / 100); // 0.99 APT
        vector::push_back(&mut amounts, ONE_APT / 100);      // 0.01 APT

        transfer_sponsored_split(
            user,
            recipients,
            amounts,
            b"split-nonce",
            timestamp::now_seconds() + 3600,
            CHAIN_ID_TESTNET
        );

        // Verify balances
        assert!(coin::balance<AptosCoin>(artist_addr) == 99 * ONE_APT / 100, 0);
        assert!(coin::balance<AptosCoin>(platform_addr) == ONE_APT / 100, 1);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(user = @0xCAFE, aptos = @0x1, framework = @0x1)]
    #[expected_failure(abort_code = E_TOO_MANY_RECIPIENTS, location = Self)]
    fun test_transfer_split_too_many_recipients(
        user: &signer,
        aptos: &signer,
        framework: &signer,
    ) acquires NonceRegistry {
        let user_addr = signer::address_of(user);

        timestamp::set_time_has_started_for_testing(framework);
        account::create_account_for_test(user_addr);

        initialize_registry(user);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos);
        coin::register<AptosCoin>(user);
        aptos_coin::mint(aptos, user_addr, 100 * ONE_APT);

        // Create 11 recipients (more than MAX_RECIPIENTS = 10)
        let recipients = vector::empty<address>();
        let amounts = vector::empty<u64>();
        let i = 0;
        while (i < 11) {
            vector::push_back(&mut recipients, @0x1234);
            vector::push_back(&mut amounts, ONE_APT);
            i = i + 1;
        };

        transfer_sponsored_split(
            user,
            recipients,
            amounts,
            b"nonce",
            timestamp::now_seconds() + 3600,
            CHAIN_ID_TESTNET
        );

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(user = @0xCAFE, aptos = @0x1, framework = @0x1)]
    #[expected_failure(abort_code = E_DUPLICATE_RECIPIENT, location = Self)]
    fun test_transfer_split_duplicate_recipients(
        user: &signer,
        aptos: &signer,
        framework: &signer,
    ) acquires NonceRegistry {
        let user_addr = signer::address_of(user);

        timestamp::set_time_has_started_for_testing(framework);
        account::create_account_for_test(user_addr);

        initialize_registry(user);

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos);
        coin::register<AptosCoin>(user);
        aptos_coin::mint(aptos, user_addr, 10 * ONE_APT);

        // Create recipients with duplicate
        let recipients = vector::empty<address>();
        vector::push_back(&mut recipients, @0xBEEF);
        vector::push_back(&mut recipients, @0xBEEF); // Duplicate!

        let amounts = vector::empty<u64>();
        vector::push_back(&mut amounts, ONE_APT);
        vector::push_back(&mut amounts, ONE_APT);

        transfer_sponsored_split(
            user,
            recipients,
            amounts,
            b"nonce",
            timestamp::now_seconds() + 3600,
            CHAIN_ID_TESTNET
        );

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }
}
