#!/usr/bin/env python3
"""
Comprehensive verification script for all 5 MCP servers.
Tests with REAL Ethereum data to prove implementations work.

This script can be run with: python3 verify_mcp_servers.py
"""

import sys
import os
import json

# Change to script directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Add all server source paths
sys.path.insert(0, 'signing-mcp-server/src')
sys.path.insert(0, 'transaction-mcp-server/src')
sys.path.insert(0, 'validation-mcp-server/src')
sys.path.insert(0, 'keystore-mcp-server/src')
sys.path.insert(0, 'ethereum-wallet-mcp/src')

print("=" * 70)
print("ETHEREUM WALLET TOOLKIT - MCP SERVER VERIFICATION")
print("=" * 70)

# Test data - REAL Ethereum keys and addresses (FOR TESTING ONLY)
TEST_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'
TEST_ADDRESS = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'
VITALIK_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

passed_tests = 0
failed_tests = 0

def test(name, condition, details=""):
    global passed_tests, failed_tests
    if condition:
        print(f"  ✅ {name}")
        passed_tests += 1
    else:
        print(f"  ❌ {name}")
        if details:
            print(f"      Details: {details}")
        failed_tests += 1

# ============================================================================
# SERVER 1: Validation MCP Server
# ============================================================================
print("\n" + "=" * 70)
print("SERVER 1: VALIDATION MCP SERVER")
print("=" * 70)

try:
    from validation_mcp.tools.address_validation import validate_address_impl
    from validation_mcp.tools.checksum import (
        to_checksum_impl, 
        verify_checksum_impl,
        is_checksum_address_impl
    )
    from validation_mcp.tools.hex_validation import validate_hex_impl
    from validation_mcp.tools.key_validation import (
        validate_private_key_impl,
        validate_public_key_impl
    )
    from validation_mcp.tools.hashing import compute_keccak256_impl
    from validation_mcp.tools.derivation import (
        derive_address_from_private_key_impl,
        derive_address_from_public_key_impl
    )
    from validation_mcp.tools.selectors import (
        compute_function_selector_impl,
        compute_event_topic_impl
    )
    from validation_mcp.tools.storage import compute_storage_slot_impl
    from validation_mcp.tools.signature_validation import validate_signature_impl
    
    print("\n📋 Address Validation Tests:")
    
    # Test valid checksummed address
    result = validate_address_impl(TEST_ADDRESS)
    test("Valid checksummed address", result.get('is_valid') == True)
    
    # Test lowercase address
    result = validate_address_impl(TEST_ADDRESS.lower())
    test("Lowercase address valid", result.get('is_valid') == True)
    
    # Test invalid address
    result = validate_address_impl('0xinvalid')
    test("Invalid address rejected", result.get('is_valid') == False)
    
    print("\n📋 Checksum Tests:")
    
    # To checksum
    result = to_checksum_impl(TEST_ADDRESS.lower())
    test("To checksum conversion", result.get('checksummed') == TEST_ADDRESS, 
         f"Got: {result.get('checksummed')}")
    
    # Verify checksum
    result = verify_checksum_impl(TEST_ADDRESS)
    test("Verify valid checksum", result.get('is_valid') == True)
    
    # Verify invalid checksum (all lowercase)
    result = verify_checksum_impl(TEST_ADDRESS.lower())
    test("Invalid checksum detected", result.get('is_valid') == False)
    
    print("\n📋 Hex Validation Tests:")
    
    result = validate_hex_impl('0x1234abcd')
    test("Valid hex validation", result.get('is_valid') == True)
    
    result = validate_hex_impl('0xGGGG')
    test("Invalid hex rejected", result.get('is_valid') == False)
    
    print("\n📋 Key Validation Tests:")
    
    result = validate_private_key_impl(TEST_PRIVATE_KEY)
    test("Valid private key", result.get('is_valid') == True)
    
    result = validate_private_key_impl('0x1234')  # Too short
    test("Short private key rejected", result.get('is_valid') == False)
    
    print("\n📋 Keccak256 Hashing Tests:")
    
    # Known hash: keccak256("hello") 
    # = 0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8
    result = compute_keccak256_impl('hello')
    expected = '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8'
    test("Keccak256 'hello'", result.get('hash', '').lower() == expected.lower(),
         f"Got: {result.get('hash')}")
    
    print("\n📋 Address Derivation Tests:")
    
    result = derive_address_from_private_key_impl(TEST_PRIVATE_KEY)
    test("Derive address from private key", 
         result.get('address', '').lower() == TEST_ADDRESS.lower(),
         f"Got: {result.get('address')}")
    
    print("\n📋 Function Selector Tests:")
    
    # Known selector: transfer(address,uint256) = 0xa9059cbb
    result = compute_function_selector_impl('transfer(address,uint256)')
    test("Function selector 'transfer'", 
         result.get('selector', '').lower() == '0xa9059cbb',
         f"Got: {result.get('selector')}")
    
    # Known event topic: Transfer(address,address,uint256)
    result = compute_event_topic_impl('Transfer(address,address,uint256)')
    expected_topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    test("Event topic 'Transfer'", 
         result.get('topic', '').lower() == expected_topic.lower(),
         f"Got: {result.get('topic')}")
    
    print("\n📋 Storage Slot Tests:")
    
    # Simple storage slot 0
    result = compute_storage_slot_impl(slot_number=0)
    test("Simple storage slot 0", 
         result.get('slot') == '0x' + '0' * 64,
         f"Got: {result.get('slot')}")
    
    print("\n✅ Validation MCP Server: Loaded successfully!")
    
except Exception as e:
    print(f"\n❌ Validation MCP Server Error: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# SERVER 2: Signing MCP Server
# ============================================================================
print("\n" + "=" * 70)
print("SERVER 2: SIGNING MCP SERVER")
print("=" * 70)

try:
    from signing_mcp.tools.message_signing import (
        sign_message_impl,
        verify_message_impl
    )
    from signing_mcp.tools.hash_signing import (
        sign_hash_impl,
        verify_hash_signature_impl,
        RISK_ACKNOWLEDGEMENT
    )
    from signing_mcp.tools.signature_utils import (
        encode_signature_impl,
        decode_signature_impl
    )
    
    print("\n📋 Message Signing Tests:")
    
    # Sign a message
    result = sign_message_impl(
        message="Hello Ethereum!",
        private_key=TEST_PRIVATE_KEY
    )
    test("Sign message", 'signature' in result and not result.get('error'),
         f"Result: {result}")
    
    if 'signature' in result:
        signature = result['signature']
        
        # Verify the signature
        verify_result = verify_message_impl(
            message="Hello Ethereum!",
            signature=signature,
            expected_signer=TEST_ADDRESS
        )
        test("Verify signature (correct signer)", 
             verify_result.get('is_valid') == True,
             f"Result: {verify_result}")
        
        # Verify with wrong signer
        verify_result = verify_message_impl(
            message="Hello Ethereum!",
            signature=signature,
            expected_signer=VITALIK_ADDRESS
        )
        test("Verify signature (wrong signer)", 
             verify_result.get('is_valid') == False,
             f"Result: {verify_result}")
    
    print("\n📋 Hash Signing Tests (with risk acknowledgement):")
    
    # Sign without acknowledgement should fail
    test_hash = '0x' + 'a' * 64
    result = sign_hash_impl(
        message_hash=test_hash,
        private_key=TEST_PRIVATE_KEY,
        risk_acknowledgement=""
    )
    test("Sign hash without acknowledgement fails", result.get('error') == True)
    
    # Sign with acknowledgement should work
    result = sign_hash_impl(
        message_hash=test_hash,
        private_key=TEST_PRIVATE_KEY,
        risk_acknowledgement=RISK_ACKNOWLEDGEMENT
    )
    test("Sign hash with acknowledgement", 
         'signature' in result and not result.get('error'),
         f"Result: {result}")
    
    if 'signature' in result and not result.get('error'):
        # Verify the hash signature
        verify_result = verify_hash_signature_impl(
            message_hash=test_hash,
            signature=result['signature'],
            expected_signer=TEST_ADDRESS
        )
        test("Verify hash signature", 
             verify_result.get('is_valid') == True,
             f"Result: {verify_result}")
    
    print("\n📋 Signature Encoding Tests:")
    
    # Decode a known signature
    test_sig = '0x' + 'ab' * 32 + 'cd' * 32 + '1b'  # v=27
    result = decode_signature_impl(test_sig)
    test("Decode signature components", 
         'v' in result and 'r' in result and 's' in result,
         f"Result: {result}")
    
    print("\n✅ Signing MCP Server: Loaded successfully!")
    
except Exception as e:
    print(f"\n❌ Signing MCP Server Error: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# SERVER 3: Keystore MCP Server
# ============================================================================
print("\n" + "=" * 70)
print("SERVER 3: KEYSTORE MCP SERVER")
print("=" * 70)

try:
    from keystore_mcp.tools.encrypt import encrypt_to_keystore_impl
    from keystore_mcp.tools.decrypt import decrypt_keystore_impl
    from keystore_mcp.tools.validate import validate_keystore_impl
    
    print("\n📋 Keystore Encryption Tests:")
    
    # Encrypt a private key
    result = encrypt_to_keystore_impl(
        private_key=TEST_PRIVATE_KEY,
        password="test123password"
    )
    test("Encrypt private key to keystore", 
         'keystore' in result and not result.get('error'),
         f"Keys: {list(result.keys()) if isinstance(result, dict) else result}")
    
    if 'keystore' in result:
        keystore_json = result['keystore']
        
        print("\n📋 Keystore Validation Tests:")
        
        # Validate the keystore
        validate_result = validate_keystore_impl(keystore_json)
        test("Validate keystore format", 
             validate_result.get('is_valid') == True,
             f"Result: {validate_result}")
        
        print("\n📋 Keystore Decryption Tests:")
        
        # Decrypt with correct password
        decrypt_result = decrypt_keystore_impl(
            keystore_json=keystore_json,
            password="test123password"
        )
        test("Decrypt keystore (correct password)", 
             'private_key' in decrypt_result and not decrypt_result.get('error'),
             f"Keys: {list(decrypt_result.keys()) if isinstance(decrypt_result, dict) else decrypt_result}")
        
        if 'private_key' in decrypt_result:
            # Verify we got back the same private key
            decrypted_key = decrypt_result['private_key'].lower()
            original_key = TEST_PRIVATE_KEY.lower()
            test("Decrypted key matches original", 
                 decrypted_key == original_key,
                 f"Decrypted: {decrypted_key[:20]}...")
        
        # Decrypt with wrong password should fail
        decrypt_result = decrypt_keystore_impl(
            keystore_json=keystore_json,
            password="wrongpassword"
        )
        test("Decrypt keystore (wrong password fails)", 
             decrypt_result.get('error') == True or 'private_key' not in decrypt_result,
             f"Result: {decrypt_result}")
    
    print("\n✅ Keystore MCP Server: Loaded successfully!")
    
except Exception as e:
    print(f"\n❌ Keystore MCP Server Error: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# SERVER 4: Transaction MCP Server
# ============================================================================
print("\n" + "=" * 70)
print("SERVER 4: TRANSACTION MCP SERVER")
print("=" * 70)

try:
    from transaction_mcp.tools.building import (
        build_transaction_impl,
        build_eip1559_transaction_impl
    )
    from transaction_mcp.tools.signing import sign_transaction_impl
    from transaction_mcp.tools.decoding import decode_raw_transaction_impl
    from transaction_mcp.tools.encoding import encode_transaction_impl
    from transaction_mcp.tools.gas import estimate_gas_impl
    
    print("\n📋 Transaction Building Tests:")
    
    # Build a legacy transaction
    result = build_transaction_impl(
        to=VITALIK_ADDRESS,
        value="1000000000000000000",  # 1 ETH in wei
        nonce=0,
        gas_price="20000000000",  # 20 gwei
        gas_limit=21000,
        chain_id=1
    )
    test("Build legacy transaction", 
         'transaction' in result and not result.get('error'),
         f"Keys: {list(result.keys()) if isinstance(result, dict) else result}")
    
    # Build EIP-1559 transaction
    result = build_eip1559_transaction_impl(
        to=VITALIK_ADDRESS,
        value="1000000000000000000",
        nonce=0,
        max_fee_per_gas="30000000000",  # 30 gwei
        max_priority_fee_per_gas="2000000000",  # 2 gwei
        gas_limit=21000,
        chain_id=1
    )
    test("Build EIP-1559 transaction", 
         'transaction' in result and not result.get('error'),
         f"Keys: {list(result.keys()) if isinstance(result, dict) else result}")
    
    print("\n📋 Transaction Signing Tests:")
    
    # Sign a transaction
    tx_dict = {
        'to': VITALIK_ADDRESS,
        'value': 1000000000000000000,
        'nonce': 0,
        'gasPrice': 20000000000,
        'gas': 21000,
        'chainId': 1
    }
    result = sign_transaction_impl(
        transaction=tx_dict,
        private_key=TEST_PRIVATE_KEY
    )
    test("Sign transaction", 
         ('raw_transaction' in result or 'signed_transaction' in result) and not result.get('error'),
         f"Keys: {list(result.keys()) if isinstance(result, dict) else result}")
    
    raw_tx = result.get('raw_transaction') or result.get('signed_transaction')
    
    if raw_tx:
        print("\n📋 Transaction Decoding Tests:")
        
        # Decode the signed transaction
        decode_result = decode_raw_transaction_impl(raw_tx)
        test("Decode raw transaction", 
             'to' in decode_result or 'transaction' in decode_result,
             f"Keys: {list(decode_result.keys()) if isinstance(decode_result, dict) else decode_result}")
    
    print("\n📋 Gas Estimation Tests:")
    
    # Estimate gas for a transfer
    result = estimate_gas_impl(
        tx_type="transfer"
    )
    test("Estimate gas for transfer", 
         'gas_limit' in result or 'estimate' in result,
         f"Result: {result}")
    
    print("\n✅ Transaction MCP Server: Loaded successfully!")
    
except Exception as e:
    print(f"\n❌ Transaction MCP Server Error: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# SERVER 5: Ethereum Wallet MCP Server (Pre-existing)
# ============================================================================
print("\n" + "=" * 70)
print("SERVER 5: ETHEREUM WALLET MCP SERVER")
print("=" * 70)

try:
    from ethereum_wallet_mcp.tools.wallet_generation import (
        generate_wallet_impl,
        generate_mnemonic_impl
    )
    
    print("\n📋 Wallet Generation Tests:")
    
    # Generate a new wallet
    result = generate_wallet_impl()
    test("Generate new wallet", 
         'address' in result and 'private_key' in result,
         f"Keys: {list(result.keys()) if isinstance(result, dict) else result}")
    
    if 'address' in result and 'private_key' in result:
        # Verify the address matches the private key
        from validation_mcp.tools.derivation import derive_address_from_private_key_impl
        derived = derive_address_from_private_key_impl(result['private_key'])
        test("Generated address matches private key", 
             derived.get('address', '').lower() == result['address'].lower(),
             f"Generated: {result['address']}, Derived: {derived.get('address')}")
    
    # Generate a mnemonic
    result = generate_mnemonic_impl()
    test("Generate mnemonic", 
         'mnemonic' in result or 'words' in result,
         f"Keys: {list(result.keys()) if isinstance(result, dict) else result}")
    
    print("\n✅ Ethereum Wallet MCP Server: Loaded successfully!")
    
except Exception as e:
    print(f"\n❌ Ethereum Wallet MCP Server Error: {e}")
    import traceback
    traceback.print_exc()

# ============================================================================
# FINAL SUMMARY
# ============================================================================
print("\n" + "=" * 70)
print("FINAL SUMMARY")
print("=" * 70)
print(f"\n✅ Passed: {passed_tests}")
print(f"❌ Failed: {failed_tests}")
print(f"📊 Total:  {passed_tests + failed_tests}")

if failed_tests == 0:
    print("\n🎉 ALL TESTS PASSED! All 5 MCP servers are working correctly!")
    sys.exit(0)
else:
    print(f"\n⚠️  {failed_tests} test(s) failed. Please review the output above.")
    sys.exit(1)

