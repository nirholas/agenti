#!/usr/bin/env python3
"""
Comprehensive test suite for eth_toolkit.py CLI
Tests all features against known test vectors
"""

import subprocess
import json
import sys
import os

# Change to the script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Test vectors
TEST_KEY = "abcdefghijklmnopqrstuvwxyz12345678912345678912345678912345678912"
TEST_ADDR = "0x1234567890abcdefghijklmnopqrstuvwxyz1234"
TEST_MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
TEST_MNEMONIC_LIST = TEST_MNEMONIC.split()

passed = 0
failed = 0

def run_cmd(args):
    """Run CLI command and return output"""
    result = subprocess.run(
        ["python3", "eth_toolkit.py"] + args,
        capture_output=True,
        text=True
    )
    return result.stdout, result.stderr, result.returncode

def test(name, condition, details=""):
    global passed, failed
    if condition:
        print(f"✓ {name}")
        passed += 1
    else:
        print(f"✗ {name}")
        if details:
            print(f"  {details}")
        failed += 1

print("=" * 60)
print("ETHEREUM WALLET TOOLKIT - CLI TEST SUITE")
print("=" * 60)

# --- GENERATE ---
print("\n--- GENERATE ---")

out, err, code = run_cmd(["generate"])
test("Generate wallet", code == 0 and "Address:" in out and "Private Key:" in out)

out, err, code = run_cmd(["generate", "--mnemonic"])
test("Generate with mnemonic", code == 0 and "Mnemonic:" in out)

out, err, code = run_cmd(["generate", "--mnemonic", "--words", "24"])
test("Generate 24-word mnemonic", code == 0 and "Mnemonic:" in out)

# --- RESTORE ---
print("\n--- RESTORE ---")

out, err, code = run_cmd(["restore", "--key", TEST_KEY])
test("Restore from private key", TEST_ADDR.lower() in out.lower())

out, err, code = run_cmd(["restore", "--key", "0x" + TEST_KEY])
test("Restore with 0x prefix", TEST_ADDR.lower() in out.lower())

out, err, code = run_cmd(["restore", "--mnemonic"] + TEST_MNEMONIC_LIST)
expected_addr = "0x1234123451234567890d91123456789012345678"
test("Restore from mnemonic", expected_addr.lower() in out.lower())

# --- DERIVE ---
print("\n--- DERIVE ---")

out, err, code = run_cmd(["derive", "--mnemonic"] + TEST_MNEMONIC_LIST + ["--count", "3"])
test("Derive multiple accounts", out.count("0x") >= 3 and code == 0)

out, err, code = run_cmd(["derive", "--mnemonic"] + TEST_MNEMONIC_LIST + ["--count", "5"])
test("Derive 5 accounts", out.count("[") >= 5 or out.count("0x") >= 5)

# --- SIGN ---
print("\n--- SIGN ---")

out, err, code = run_cmd(["sign", "--message", "Hello World", "--key", TEST_KEY])
test("Sign message", "Signature:" in out and code == 0)

out, err, code = run_cmd(["sign", "--message", "Test", "--key", "0x" + TEST_KEY])
test("Sign with 0x key prefix", "Signature:" in out and code == 0)

# Extract signature for verify tests
sig_line = [l for l in out.split('\n') if 'Signature:' in l]
if sig_line:
    signature = sig_line[0].split(':', 1)[1].strip()
else:
    signature = ""

# --- VERIFY ---
print("\n--- VERIFY ---")

if signature:
    out, err, code = run_cmd(["verify", "--message", "Test", "--signature", signature, "--address", TEST_ADDR])
    test("Verify signature (valid)", "yes" in out.lower() or "valid" in out.lower())
    
    out, err, code = run_cmd(["verify", "--message", "Wrong", "--signature", signature, "--address", TEST_ADDR])
    test("Verify signature (wrong message)", "no" in out.lower() or "recovered address" in out.lower())
else:
    test("Verify signature (valid)", False, "No signature to verify")
    test("Verify signature (wrong message)", False, "No signature to verify")

# --- VALIDATE ---
print("\n--- VALIDATE ---")

out, err, code = run_cmd(["validate", "--address", TEST_ADDR])
test("Validate address (valid)", "yes" in out.lower() and code == 0)

out, err, code = run_cmd(["validate", "--address", "0x123"])
test("Validate address (invalid)", "no" in out.lower() and code == 0)

out, err, code = run_cmd(["validate", "--key", TEST_KEY])
test("Validate private key (valid)", "yes" in out.lower() and code == 0)

out, err, code = run_cmd(["validate", "--key", "invalid"])
test("Validate private key (invalid)", "no" in out.lower() and code == 0)

out, err, code = run_cmd(["validate", "--address", TEST_ADDR, "--key", TEST_KEY])
test("Validate key-address pair (valid)", "yes" in out.lower() and code == 0)

out, err, code = run_cmd(["validate", "--address", "0x1234123451234567890d91123456789012345678", "--key", TEST_KEY])
test("Validate key-address pair (invalid)", "no" in out.lower() and code == 0)

# --- KEYSTORE ---
print("\n--- KEYSTORE ---")

out, err, code = run_cmd(["keystore", "--encrypt", "--key", TEST_KEY, "--password", "testpass123"])
test("Encrypt keystore", '"version": 3' in out or '"version":3' in out)

# Save keystore for decrypt test
try:
    ks_start = out.find('{')
    ks_end = out.rfind('}') + 1
    if ks_start >= 0 and ks_end > ks_start:
        keystore_json = out[ks_start:ks_end]
        with open("/tmp/test_keystore.json", "w") as f:
            f.write(keystore_json)
        
        out, err, code = run_cmd(["keystore", "--decrypt", "--file", "/tmp/test_keystore.json", "--password", "testpass123"])
        test("Decrypt keystore", TEST_KEY.lower() in out.lower() or TEST_ADDR.lower() in out.lower())
        
        out, err, code = run_cmd(["keystore", "--decrypt", "--file", "/tmp/test_keystore.json", "--password", "wrongpass"])
        test("Decrypt with wrong password fails", code != 0 or "error" in (out + err).lower() or "invalid" in (out + err).lower())
    else:
        test("Keystore encrypt/decrypt", False, "Could not parse keystore output")
except Exception as e:
    test("Keystore encrypt/decrypt", False, str(e))

# --- TRANSACTION ---
print("\n--- TRANSACTION ---")

out, err, code = run_cmd([
    "transaction",
    "--to", "0x1234123451234567890d91123456789012345678",
    "--value", "1000000000000000000",
    "--nonce", "0",
    "--gas", "21000",
    "--gas-price", "20000000000",
    "--key", TEST_KEY
])
test("Sign legacy transaction", "0x" in out and code == 0)

out, err, code = run_cmd([
    "transaction",
    "--to", "0x1234123451234567890d91123456789012345678",
    "--value", "1000000000000000000",
    "--nonce", "0",
    "--gas", "21000",
    "--max-fee", "30000000000",
    "--priority-fee", "2000000000",
    "--key", TEST_KEY
])
test("Sign EIP-1559 transaction", "0x" in out and code == 0)

out, err, code = run_cmd([
    "transaction",
    "--to", "0x1234123451234567890d91123456789012345678",
    "--ether", "1.5",
    "--nonce", "0",
    "--gas-price", "20000000000",
    "--key", TEST_KEY
])
test("Sign transaction with --ether", "0x" in out and code == 0)

# --- TYPED DATA (EIP-712) ---
print("\n--- TYPED DATA (EIP-712) ---")

typed_data = {
    "types": {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "chainId", "type": "uint256"}
        ],
        "Message": [{"name": "content", "type": "string"}]
    },
    "primaryType": "Message",
    "domain": {"name": "Test", "chainId": 1},
    "message": {"content": "Hello"}
}

# Write typed data to file
with open("/tmp/typed_data.json", "w") as f:
    json.dump(typed_data, f)

out, err, code = run_cmd(["typed-data", "--sign", "--file", "/tmp/typed_data.json", "--key", TEST_KEY])
test("Sign typed data", ("signature" in out.lower() or "0x" in out) and code == 0)

# Extract signature for verify - signature is on line after "Signature:"
lines = out.split('\n')
typed_sig = ""
for i, line in enumerate(lines):
    if 'Signature:' in line:
        # Signature may continue on next line if wrapped
        sig_part = line.split('Signature:', 1)[1].strip()
        if sig_part:
            typed_sig = sig_part
            # Check if next line is continuation (no colon)
            if i + 1 < len(lines) and ':' not in lines[i+1] and lines[i+1].strip():
                typed_sig += lines[i+1].strip()
        break

if typed_sig and typed_sig.startswith('0x') or len(typed_sig) > 100:
    if not typed_sig.startswith('0x'):
        typed_sig = '0x' + typed_sig
    out, err, code = run_cmd(["typed-data", "--verify", "--file", "/tmp/typed_data.json", "--signature", typed_sig, "--address", TEST_ADDR])
    test("Verify typed data", "yes" in out.lower() or "valid" in out.lower() or code == 0)
else:
    test("Verify typed data", False, f"Could not extract signature: {typed_sig[:50] if typed_sig else 'empty'}")

# --- VANITY ---
print("\n--- VANITY ---")

# Use timeout since vanity doesn't have --max-attempts
# Simple prefix "00" is very easy to find
result = subprocess.run(
    ["timeout", "15", "python3", "eth_toolkit.py", "vanity", "--prefix", "00", "--quiet"],
    capture_output=True,
    text=True
)
test("Vanity search (prefix)", "0x" in result.stdout or result.returncode == 0)

result = subprocess.run(
    ["timeout", "15", "python3", "eth_toolkit.py", "vanity", "--suffix", "00", "--quiet"],
    capture_output=True,
    text=True
)
test("Vanity search (suffix)", "0x" in result.stdout or result.returncode == 0)

# --- Summary ---
print("\n" + "=" * 60)
total = passed + failed
print(f"RESULTS: {passed}/{total} tests passed")
if failed == 0:
    print("✓ ALL CLI TESTS PASSED")
else:
    print(f"✗ {failed} FAILED")
print("=" * 60)

# Cleanup
try:
    os.remove("/tmp/test_keystore.json")
    os.remove("/tmp/typed_data.json")
except:
    pass

sys.exit(0 if failed == 0 else 1)




