#include "MachinePalDb.h"
#include "MachinePalCommon.h"
#include <soci/postgresql/soci-postgresql.h>
#include <soci/sqlite3/soci-sqlite3.h>
#include <spdlog/sinks/stdout_sinks.h>
#include <filesystem>
#include <memory>     // For std::make_unique
#include <stdexcept>  // For std::runtime_error

#include "MachinePalApp.h"
#include "PaymentRecord.h"
#include "config/subconfigs/ResourceConfig.h"
#include "crypto/EIP712Domain.h"
#include "payment/datastructures/PaymentPayload.h"

using namespace std;


void MachinePalDb::checkSqliteFileOnDisk() {
    if ( std::filesystem::exists( connectionString_ ) ) {
        if ( std::filesystem::is_directory( connectionString_ ) ) {
            throw std::runtime_error(
                "SQLite database path is a directory, not a file: " + connectionString_ );
        }
        std::fstream file( connectionString_, std::ios::in | std::ios::out );
        if ( !file.is_open() ) {
            throw std::runtime_error(
                "Permissions problem: cannot open SQLite database file for read/write: " +
                connectionString_ );
        }
        file.close();
    } else {
        LOG_DB_INFO("SQLite database file does not exist at {}, it will be created.", connectionString_ );
    }
}

void MachinePalDb::verifyDatabaseConnectivity() {
    try {
        if ( dbType_ == DbType::SQLite ) {
            checkSqliteFileOnDisk();
        }
        soci::backend_factory const& backendTest = getBackend( dbType_ );
        soci::session testSess( backendTest, connectionString_ );
        // Use a universal, simple query to confirm the connection is "live"
        // This works for PostgreSQL, SQLite, MySQL, etc.
        int one = 0;
        testSess << "SELECT 1", soci::into( one );
        // Your custom check macro (or use a standard assert/exception)
        CHECK_STATE2(
            one == 1, "Database connectivity check failed: unexpected; result from test query" );
    } catch ( std::exception const& e ) {
        std::string errorMsg = "Initial connectivity check failed: " + std::string( e.what() );
        RETHROW_NESTED2( errorMsg );  // Or however your framework propagates exceptions
    } catch ( ... ) {
        RETHROW_NESTED2( "Initial connectivity check failed with an unknown error" );
    }

    std::string backendName =
        ( dbType_ == DbType::SQLite ) ? "SQLite (at " + connectionString_ + ")" : "PostgreSQL";
    LOG_DB_INFO( "Database connectivity verified successfully. Using {}.", backendName );
}

void MachinePalDb::configureDBParamsAndPool() {
    const int POOL_SIZE = 8;
    soci::backend_factory const& backend = getBackend( dbType_ );
    pool_ = std::make_unique< soci::connection_pool >( POOL_SIZE );
    for ( std::size_t i = 0; i < POOL_SIZE; ++i ) {
        soci::session& sess = pool_->at( i );
        sess.open( backend, connectionString_ );
        if ( dbType_ == DbType::SQLite ) {
            sess << "PRAGMA journal_mode=WAL";  // apply to every pooled connection
            sess << "PRAGMA busy_timeout = 5000";
            sess << "PRAGMA synchronous = NORMAL";   // Balance durability & performance
            sess << "PRAGMA temp_store = MEMORY";    // Use RAM for temp tables/sorts
            sess << "PRAGMA cache_size = -20000";    // 20MB in-memory page cache (negative = KB)
            sess << "PRAGMA mmap_size = 268435456";  // 256MB memory mapping for reads
        }
    }
}

/**
 * @brief Constructs the PaymentDB.
 */
MachinePalDb::MachinePalDb(
    MachinePalApp& app, DbType type, const std::optional< std::string >& connectionInfo )
    : app_( app ), dbType_( type ) {
    try {


        if ( dbType_ == DbType::SQLite ) {
            // Ensure config directory exists, then build DB file path
            auto dataDir = app_.configPath() / "data";
            std::filesystem::create_directories( dataDir );
            connectionString_ = ( dataDir / "machinepal.db" ).string();
        } else {
            CHECK_STATE( connectionInfo );
            connectionString_ = connectionInfo.value();
        }

        verifyDatabaseConnectivity();
        ensureSchema();
        configureDBParamsAndPool();
    } catch ( ... ) {
        RETHROW_NESTED2( "Failed to initialize PaymentDB" );
    }
}

void MachinePalDb::saveSettledPayment( const PaymentPayload& payload, const EIP712Domain& domain,
    const ResourceConfig& resource, const OrganizationConfig& organization,
    const Hash& transactionHash, const string& ipAddress ) {
    auto paymentRecord = PaymentRecord::createPaymentRecord(
        payload, domain, resource, organization, transactionHash, ipAddress );
    CHECK_STATE( paymentRecord );
    writePayment( *paymentRecord );
}

bool MachinePalDb::settledPaymentExists(
    const ptr< PaymentPayload >& paymentPayload, const ptr< EIP712Domain >& domain ) {
    // Extract fields needed to check for existing payment.
    auto from = paymentPayload->payload()->authorization()->from();
    auto nonce = paymentPayload->payload()->authorization()->nonce();
    auto asset = domain->assetAddress();
    auto chainId = domain->chainId();
    return paymentExists( from, asset, nonce, chainId );
}

/**
 * @brief Writes a payment record to the database.
 */
/**
 * @brief Writes a payment record to the database.
 */


// --- Private Helpers ---

/**
 * @brief Gets the appropriate SOCI backend factory based on the DbType.
 */
soci::backend_factory const& MachinePalDb::getBackend( DbType type ) {
    switch ( type ) {
    case DbType::SQLite:
        return soci::sqlite3;
    case DbType::PostgreSQL: {
#ifdef ENABLE_POSTGRESQL
        return soci::postgresql;
#else
        throw std::runtime_error( "PostgreSQL backend not enabled at build time" );
#endif
    }
    default:
        // This should not be reachable if all enum values are handled
        throw std::runtime_error( "Unsupported database type" );
    }
}

/**
 * @brief Ensures the database schema (tables and indices) exists.
 */
void MachinePalDb::ensureSchema() {
    try {
        // Create a single, temporary session just for schema initialization.
        soci::backend_factory const& backend = getBackend( dbType_ );
        soci::session sql( backend, connectionString_ );

        if ( dbType_ == DbType::SQLite ) {
            sql << "PRAGMA journal_mode=WAL";
        }

        // check if table exists

        bool tableExisted = false;

        // --- Step 1: Check if the table already exists ---
        if ( dbType_ == DbType::SQLite ) {
            int count = 0;
            // Query the SQLite master table for our table
            sql << "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='payments'",
                soci::into( count );
            tableExisted = ( count > 0 );
        } else if ( dbType_ == DbType::PostgreSQL ) {
            std::string tableName;
            soci::indicator ind;
            // to_regclass('payments') returns NULL if the table does not exist.
            // soci will set the indicator to i_null in that case.
            sql << "SELECT to_regclass(current_schema() || '.payments')",
                soci::into( tableName, ind );
            tableExisted = ( ind != soci::i_null );
        }

        // Use conditional DDL for backend-specific syntax
        if ( dbType_ == DbType::SQLite ) {
            sql << "CREATE TABLE IF NOT EXISTS payments ("
                   "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                   "organizationName TEXT NOT NULL,"
                   "chainId TEXT NOT NULL,"
                   "fromAddress TEXT NOT NULL,"
                   "toAddress TEXT NOT NULL,"
                   "assetAddress TEXT NOT NULL,"
                   "value TEXT NOT NULL,"
                   "nonce TEXT NOT NULL,"
                   "resourceLocation TEXT NOT NULL,"
                   "settlementTime INTEGER NOT NULL,"
                   "authorizationSignatureHash TEXT NOT NULL,"
                   "transactionHash TEXT NOT NULL,"
                   "fromIpAddress TEXT NOT NULL,"
                   "jsonInfo TEXT)";
        } else if ( dbType_ == DbType::PostgreSQL ) {
            sql << "CREATE TABLE IF NOT EXISTS payments ("
                   "id SERIAL PRIMARY KEY,"
                   "organizationName TEXT NOT NULL,"
                   "chainId TEXT NOT NULL,"
                   "fromAddress TEXT NOT NULL,"
                   "toAddress TEXT NOT NULL,"
                   "assetAddress TEXT NOT NULL,"
                   "value TEXT NOT NULL,"
                   "nonce TEXT NOT NULL,"
                   "resourceLocation TEXT NOT NULL,"
                   "settlementTime BIGINT NOT NULL,"
                   "authorizationSignatureHash TEXT NOT NULL,"
                   "transactionHash TEXT NOT NULL,"
                   "fromIpAddress TEXT NOT NULL,"
                   "jsonInfo TEXT)";
        }

        sql << "CREATE INDEX IF NOT EXISTS idx_payments_fromaddress ON payments(fromAddress)";
        sql << "CREATE INDEX IF NOT EXISTS idx_payments_settlementTime ON payments(settlementTime)";
        sql << "CREATE INDEX IF NOT EXISTS idx_payments_to_settlementTime ON payments(toAddress, "
               "settlementTime)";
        sql << "CREATE INDEX IF NOT EXISTS idx_payments_authhash ON "
               "payments(authorizationSignatureHash)";
        sql << "CREATE INDEX IF NOT EXISTS idx_payments_txhash ON payments(transactionHash)";
        sql << "CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_payment ON "
               "payments(fromAddress, chainId, assetAddress, nonce)";

        // --- Step 4: Log based on our check ---
        if ( !tableExisted ) {
            LOG_DB_INFO("New 'payments' table created and schema initialized." );
        }
    } catch ( std::exception& e ) {
        RETHROW_NESTED2( "Failed to ensure schema " + string( e.what() ) );
    }
}

[[nodiscard]] std::unique_ptr< soci::connection_pool >& MachinePalDb::pool() {
    CHECK_STATE( pool_ );
    return pool_;
}


void MachinePalDb::writePayment( const PaymentRecord& record ) {
    try {
        soci::session sql( *pool_ );

        // Store record fields in local variables
        std::string organizationName = record.organizationName();
        std::string chainId = record.chainId().str();
        std::string fromAddress = record.fromAddress().toDbString();
        std::string toAddress = record.toAddress().toDbString();
        std::string assetAddress = record.assetAddress().toDbString();
        std::string value = record.value().toDbString();
        std::string nonce = record.nonce().toDbString();
        std::string resourceLocation = record.resourceLocation();
        long long settlementTime = static_cast< long long >( record.settlementTime() );
        std::string authorizationSignatureHash =
            Encoding::hashToHex( record.authorizationSignatureHash() );
        std::string transactionHash = Encoding::hashToHex( record.transactionHash() );
        std::string fromIpAddress = record.fromIpAddress();
        std::string jsonInfo = record.jsonInfo();


        LOG_DB_TRACE(
            "Writing payment: organizationName={}, chainId={}, fromAddress={}, toAddress={}, "
            "assetAddress={}, value={}, "
            "nonce={}, resourceLocation ={}, settlementTime={}, authorizationSignatureHash={}, "
            "transactionHash={}, fromIpAddress={}, jsonInfo={}",
            organizationName, chainId, fromAddress, toAddress, assetAddress, value, nonce,
            resourceLocation, settlementTime, authorizationSignatureHash, transactionHash,
            fromIpAddress, jsonInfo );

        // Insert into the database using explicit named bindings for safety and cross-backend
        // consistency
        sql << R"(
            INSERT INTO payments (
                organizationName, chainId, fromAddress, toAddress, assetAddress, value, nonce, resourceLocation ,
                settlementTime, authorizationSignatureHash, transactionHash, fromIpAddress, jsonInfo
            )
            VALUES (
                :organizationName, :chainId, :fromAddress, :toAddress, :assetAddress, :value, :nonce, :resourceLocation ,
                :settlementTime, :authorizationSignatureHash, :transactionHash, :fromIpAddress, :jsonInfo
            )
        )",
            soci::use( organizationName, "organizationName" ), soci::use( chainId, "chainId" ),
            soci::use( fromAddress, "fromAddress" ), soci::use( toAddress, "toAddress" ),
            soci::use( assetAddress, "assetAddress" ), soci::use( value, "value" ),
            soci::use( nonce, "nonce" ), soci::use( resourceLocation, "resourceLocation" ),
            soci::use( settlementTime, "settlementTime" ),
            soci::use( authorizationSignatureHash, "authorizationSignatureHash" ),
            soci::use( transactionHash, "transactionHash" ),
            soci::use( fromIpAddress, "fromIpAddress" ), soci::use( jsonInfo, "jsonInfo" );
    } catch ( std::exception& e ) {
        RETHROW_NESTED2( "Failed to write payment:" + string( e.what() ) );
    }
}

bool MachinePalDb::paymentExists( const EthAddress& fromAddress, const EthAddress& assetAddress,
    const EIP3009Nonce& nonce, u256 chainId ) {
    try {
        soci::session sql( *pool_ );
        int count = 0;

        // Store temporary values in local variables
        std::string fromAddrHex = fromAddress.toHex( PREFIX_NONE );
        std::string assetAddrHex = assetAddress.toHex( PREFIX_NONE );
        std::string nonceHex = nonce.toHex( PREFIX_NONE );
        std::string chainIdStr = chainId.str();

        // Execute the query
        sql << "SELECT COUNT(*) FROM payments WHERE fromAddress = :fromAddress AND nonce = :nonce "
               "AND assetAddress = :assetAddress AND chainId = :chainId",
            soci::use( fromAddrHex, "fromAddress" ), soci::use( nonceHex, "nonce" ),
            soci::use( assetAddrHex, "assetAddress" ), soci::use( chainIdStr, "chainId" ),
            soci::into( count );

        return count > 0;
    } catch ( std::exception& e ) {
        RETHROW_NESTED2( "Failed to check if payment exists:" + string( e.what() ) );
    }
}