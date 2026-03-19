#pragma once

#include "PaymentRecord.h"
#include "payment/datastructures/PaymentPayload.h"
#include "x402_protocol/HttpError.h"

#include <soci/connection-pool.h>
#include <soci/soci.h>

class EIP712Domain;
class HttpError;
class ResourceConfig;
class PaymentPayload;
class EthAddress;
class EIP3009Nonce;
class PaymentRecord;
// Forward-declare MachinePalApp to avoid circular include
class MachinePalApp;

/**
 * @brief Defines the supported database backend types.
 */
enum class DbType { SQLite, PostgreSQL };

/**
 * @brief Manages database operations for payments using SOCI.
 * This class is now thread-safe due to the use of soci::connection_pool.
 */
class MachinePalDb {
public:
    /**
     * @brief Constructs the PaymentDB and initializes the connection pool.
     * @param app Reference to the main application class.
     * @param type The database backend to use (SQLite or PostgreSQL).
     * @param connectionInfo For PostgreSQL: the full connection string.
     */
    MachinePalDb( MachinePalApp& app, DbType type,
        const std::optional< std::string >& connectionInfo = std::nullopt );

    void saveSettledPayment( const PaymentPayload& payload, const EIP712Domain& domain,
        const ResourceConfig& resource, const OrganizationConfig& organization,
        const Hash& transactionHash, const string& ipAddress );

    bool settledPaymentExists(
        const ptr< PaymentPayload >& paymentPayload, const ptr< EIP712Domain >& domain );

    /** Critical properties - should be analyzed in detail during code review
     *
     *  after saveSettledPayment is called with a PaymentPayload representing a successful payment,
     *  subsequent calls to settledPaymentExists with the same PaymentPayload and EIP712Domain
     *  shall return true.
     */
private:
    void checkSqliteFileOnDisk();

    void verifyDatabaseConnectivity();

    void configureDBParamsAndPool();

    /**
     * @brief Writes a payment record to the database.
     * This method is thread-safe.
     */
    void writePayment( const PaymentRecord& record );


    /**
     * @brief Checks if a payment with the given parameters already exists.
     * This method is thread-safe.
     */
    bool paymentExists( const EthAddress& fromAddress, const EthAddress& assetAddress,
        const EIP3009Nonce& nonce, u256 chainId );


    /**
     * @brief Ensures the database schema (tables and indices) exists.
     */
    void ensureSchema();

    // Member variables
    MachinePalApp& app_;

    [[nodiscard]] std::unique_ptr< soci::connection_pool >& pool();

protected:
    /**
     * @brief Gets the appropriate SOCI backend factory based on the DbType.
     */
    soci::backend_factory const& getBackend( DbType type );

    DbType dbType_;

    std::string connectionString_;


    /**
     * @brief Thread-safe connection pool.
     */
    std::unique_ptr< soci::connection_pool > pool_;
public:
    virtual ~MachinePalDb() = default; // added virtual destructor for polymorphic base
};