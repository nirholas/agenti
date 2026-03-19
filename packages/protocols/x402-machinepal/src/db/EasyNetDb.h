#pragma once

#include "MachinePalCommon.h"
#include "MachinePalDb.h"
#include "crypto/TokenAmount.h"
#include "crypto/EthAddress.h"

class EasyNetDb : public MachinePalDb {
public:
    /**
     * @brief Constructs an EasyNetDb instance.
     * @param app Reference to the MachinePalApp application context.
     * @param type Database type (e.g., SQLite, PostgreSQL).
     * @param connectionInfo Optional database connection string or configuration.
     *
     * Initializes the database connection and prepares internal state for payment operations.
     */
    EasyNetDb(
        MachinePalApp& app, DbType type, const std::optional< std::string >&
                                                connectionInfo = std::nullopt);


    /**
     * @brief Processes a transfer request between two wallets for a specific asset.
     * @param fromAddress Sender's wallet address.
     * @param toAddress Recipient's wallet address.
     * @param assetAddress Asset (token) address.
     * @param value Amount to transfer.
     * @param nonce
     * @return TransferResult enum indicating success or insufficient funds.
     *
     * This method acquires a write lock, checks balances, and updates the state table if the
     * transfer is valid. It ensures thread-safe modification of wallet balances and prevents
     * overdrafts.
     */
    std::optional<FacilitatorError> processTransferRequest( const EthAddress& fromAddress,
        const EthAddress& toAddress, const EthAddress& assetAddress, const TokenAmount& value,
        EIP3009Nonce nonce, const std::string& resourceLocation, const std::string& fromIpAddress,
        const std::string& jsonInfo, const std::string& transactionHash,
        const u256& chainId,
        const std::string& authorizationSignatureHash );
    void insertTransaction( soci::session& databaseSession,
        const std::string& fromWalletAddressDatabaseString,
        const std::string& toWalletAddressDatabaseString,
        const std::string& assetContractAddressDatabaseString, const std::string& nonceString,
        const std::string& transactionHash, const std::string& resourceLocation,
        const std::string& fromIpAddress, const std::string& jsonInfo,
        std::string& transferAmountValueStr,
        const std::string& chainIdStr, const std::string& authorizationSignatureHash );
    void insertIntoState( soci::session& databaseSession,
        std::string& toWalletAddressDatabaseString, std::string& assetContractAddressDatabaseString,
        std::string& receiverUpdatedBalanceDecimalString );
    void updateState( soci::session& databaseSession, std::string& toWalletAddressDatabaseString,
        std::string& assetContractAddressDatabaseString,
        std::string& receiverUpdatedBalanceDecimalString );


    /**
     * @brief Queries the balance of a wallet for a specific asset.
     * @param walletAddress Wallet address to query.
     * @param assetAddress Asset (token) address.
     * @return std::optional<u256> containing the balance, or std::nullopt if the wallet/asset pair
     * does not exist.
     *
     * This method acquires a read lock and provides a thread-safe, read-only view of the wallet's
     * balance for the given asset.
     */
    std::optional< u256 > getBalance(
        const EthAddress& walletAddress, const EthAddress& assetAddress ) const;

private:
    void newWalletUnsafe( const EthAddress& walletAddress, const EthAddress& assetAddress,
        const TokenAmount& value );


    std::optional<FacilitatorError> transferValueUnsafe( const EthAddress& fromAddress, const EthAddress& toAddress,
        const EthAddress& assetAddress, const TokenAmount& value, EIP3009Nonce& nonce,
        const std::string& resourceLocation, const std::string& fromIpAddress,
        const std::string& jsonInfo, const std::string& transactionHash,
        const u256& chainId,
        const std::string& authorizationSignatureHash );
    // Funds a wallet with initial tokens if it does not yet exist for the given asset.
    // Initial amount: 1,000,000,000 * 10^18 (1e27) token units.
    void fundUserWalletWithFundsIfNewWalletUnsafe(
        const EthAddress& walletAddress, const EthAddress& assetAddress );

    mutable std::shared_mutex stateMutex_;  // protects state table operations
};