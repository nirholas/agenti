# Changelog

All notable changes to x402a-contract will be documented in this file.

## [0.2.0] - 2025-11-14

### Added
- ✨ **Fungible Asset Support**: New functions `transfer_sponsored_fa` and `transfer_sponsored_fa_split` for FA transfers
- 📊 **New Events**: `TransferFAEvent` and `TransferFASplitEvent` for tracking FA transfers
- 🏪 **Primary Store Integration**: Uses Aptos primary fungible stores for seamless FA management
- 📖 **Enhanced Documentation**: Updated inline docs with FA examples

### Changed
- 🔄 Backward compatible with v0.1.0 - all existing Coin functions unchanged
- 📝 Updated module header to reflect both Coin and FA support

### Security
- 🔒 All security features from v0.1.0 apply to FA transfers:
  - Nonce-based replay protection
  - Time-based expiration
  - Chain ID validation
  - Duplicate recipient detection
  - Overflow protection

## [0.1.0] - 2025-11-14

### Added
- Initial release with APT Coin support
- `transfer_sponsored` - Single recipient sponsored transfer
- `transfer_sponsored_split` - Multi-recipient sponsored transfer
- `initialize_registry` - Nonce registry initialization
- Comprehensive test suite (8/8 tests passing)
- Security features:
  - Nonce-based replay protection
  - Time-based authorization expiration
  - Chain ID validation (mainnet/testnet/devnet)
  - Multi-recipient validation with duplicate detection
  - Overflow protection for split transfers
  - Event emission for tracking
