// Test script for the ethereumjs bundled wallet
// Run with: node test-wallet.js

import * as W from './src/wallet.js';

console.log('='.repeat(60));
console.log('ETHEREUM WALLET TOOLKIT - TEST SUITE');
console.log('Testing official ethereumjs bundled version');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${e.message}`);
        failed++;
    }
}

async function asyncTest(name, fn) {
    try {
        await fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${e.message}`);
        failed++;
    }
}

// Known test vectors
const TEST_PRIVATE_KEY = '4a1234567890abcdefghijklmnopqrstuvwxyz123412345678900000000000';
const TEST_ADDRESS = '0x1234123451234567890d91123456789012345678';
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

console.log('\n--- WALLET GENERATION ---');

test('Generate random wallet', () => {
    const wallet = W.generateWallet();
    if (!wallet.address.startsWith('0x')) throw new Error('Invalid address format');
    if (wallet.address.length !== 42) throw new Error('Invalid address length');
    if (!wallet.privateKey.startsWith('0x')) throw new Error('Invalid private key format');
    if (wallet.privateKey.length !== 66) throw new Error('Invalid private key length');
    console.log(`  Generated: ${wallet.address}`);
});

test('Import from private key', () => {
    const wallet = W.privateKeyToWallet(TEST_PRIVATE_KEY);
    if (wallet.address.toLowerCase() !== TEST_ADDRESS.toLowerCase()) {
        throw new Error(`Address mismatch: expected ${TEST_ADDRESS}, got ${wallet.address}`);
    }
    console.log(`  Imported: ${wallet.address}`);
});

test('Import from private key without 0x prefix', () => {
    const wallet = W.privateKeyToWallet(TEST_PRIVATE_KEY.slice(2));
    if (wallet.address.toLowerCase() !== TEST_ADDRESS.toLowerCase()) {
        throw new Error('Address mismatch');
    }
});

console.log('\n--- MNEMONIC / HD WALLET ---');

test('Create new mnemonic (12 words)', () => {
    const mnemonic = W.createMnemonic(12);
    const words = mnemonic.split(' ');
    if (words.length !== 12) throw new Error(`Expected 12 words, got ${words.length}`);
    console.log(`  Mnemonic: ${mnemonic.slice(0, 30)}...`);
});

test('Create new mnemonic (24 words)', () => {
    const mnemonic = W.createMnemonic(24);
    const words = mnemonic.split(' ');
    if (words.length !== 24) throw new Error(`Expected 24 words, got ${words.length}`);
});

test('Validate mnemonic phrase', () => {
    if (!W.validateMnemonicPhrase(TEST_MNEMONIC)) throw new Error('Valid mnemonic rejected');
    if (W.validateMnemonicPhrase('invalid mnemonic phrase')) throw new Error('Invalid mnemonic accepted');
});

test('Recover wallet from mnemonic', () => {
    const wallet = W.mnemonicToWallet(TEST_MNEMONIC);
    // Standard derivation path m/44'/60'/0'/0/0 for "abandon" mnemonic
    const expectedAddress = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
    if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new Error(`Address mismatch: expected ${expectedAddress}, got ${wallet.address}`);
    }
    console.log(`  Recovered: ${wallet.address}`);
});

test('Derive multiple accounts from mnemonic', () => {
    const accounts = W.deriveAccounts(TEST_MNEMONIC, 5);
    if (accounts.length !== 5) throw new Error(`Expected 5 accounts, got ${accounts.length}`);
    console.log(`  Derived ${accounts.length} accounts`);
    accounts.forEach((a, i) => console.log(`    [${i}] ${a.address}`));
});

console.log('\n--- MESSAGE SIGNING (EIP-191) ---');

test('Sign message', () => {
    const result = W.signMessage('Hello World', TEST_PRIVATE_KEY);
    if (!result.signature.startsWith('0x')) throw new Error('Invalid signature format');
    if (result.signature.length !== 132) throw new Error('Invalid signature length');
    if (!result.r.startsWith('0x')) throw new Error('Invalid r value');
    if (!result.s.startsWith('0x')) throw new Error('Invalid s value');
    if (result.v < 27 || result.v > 28) throw new Error('Invalid v value');
    console.log(`  Signature: ${result.signature.slice(0, 40)}...`);
});

test('Verify message signature', () => {
    const signed = W.signMessage('Test Message', TEST_PRIVATE_KEY);
    const result = W.verifyMessage('Test Message', signed.signature, TEST_ADDRESS);
    if (!result.isValid) throw new Error('Signature verification failed');
    if (result.recoveredAddress.toLowerCase() !== TEST_ADDRESS.toLowerCase()) {
        throw new Error('Recovered address mismatch');
    }
});

test('Verify rejects wrong message', () => {
    const signed = W.signMessage('Original Message', TEST_PRIVATE_KEY);
    const result = W.verifyMessage('Different Message', signed.signature, TEST_ADDRESS);
    if (result.isValid) throw new Error('Should have rejected wrong message');
});

console.log('\n--- VALIDATION ---');

test('Validate address - valid', () => {
    if (!W.validateAddress('0x1234123451234567890d91123456789012345678')) {
        throw new Error('Valid address rejected');
    }
});

test('Validate address - invalid', () => {
    if (W.validateAddress('0x123')) throw new Error('Short address accepted');
    if (W.validateAddress('not an address')) throw new Error('Invalid format accepted');
    if (W.validateAddress('0x1234123451234567890d91123456789012345678')) throw new Error('Invalid hex accepted');
});

test('Validate private key - valid', () => {
    if (!W.validatePrivateKey(TEST_PRIVATE_KEY)) throw new Error('Valid key rejected');
    if (!W.validatePrivateKey(TEST_PRIVATE_KEY.slice(2))) throw new Error('Valid key without 0x rejected');
});

test('Validate private key - invalid', () => {
    if (W.validatePrivateKey('0x123')) throw new Error('Short key accepted');
    if (W.validatePrivateKey('not a key')) throw new Error('Invalid format accepted');
});

test('Validate key-address pair', () => {
    if (!W.validateKeyAddressPair(TEST_PRIVATE_KEY, TEST_ADDRESS)) {
        throw new Error('Valid pair rejected');
    }
    if (W.validateKeyAddressPair(TEST_PRIVATE_KEY, '0x1234123451234567890d91123456789012345678')) {
        throw new Error('Invalid pair accepted');
    }
});

console.log('\n--- KEYSTORE ---');

await asyncTest('Encrypt to keystore', async () => {
    const keystore = await W.encryptKeystore(TEST_PRIVATE_KEY, 'testpassword123');
    if (keystore.version !== 3) throw new Error('Wrong keystore version');
    if (!keystore.crypto) throw new Error('Missing crypto section');
    if (!keystore.address) throw new Error('Missing address');
    console.log(`  Keystore address: ${keystore.address}`);
});

await asyncTest('Encrypt and decrypt keystore', async () => {
    const keystore = await W.encryptKeystore(TEST_PRIVATE_KEY, 'mypassword');
    const wallet = await W.decryptKeystore(keystore, 'mypassword');
    if (wallet.address.toLowerCase() !== TEST_ADDRESS.toLowerCase()) {
        throw new Error('Decrypted address mismatch');
    }
});

await asyncTest('Decrypt with wrong password fails', async () => {
    const keystore = await W.encryptKeystore(TEST_PRIVATE_KEY, 'correctpassword');
    try {
        await W.decryptKeystore(keystore, 'wrongpassword');
        throw new Error('Should have thrown error');
    } catch (e) {
        if (!e.message.includes('Invalid password') && !e.message.includes('MAC')) {
            throw e;
        }
    }
});

console.log('\n--- TRANSACTION SIGNING ---');

test('Sign legacy transaction', () => {
    const txParams = {
        to: '0x1234123451234567890d91123456789012345678',
        value: '1000000000000000000', // 1 ETH in wei
        nonce: 0,
        gas: 21000,
        gasPrice: '20000000000' // 20 Gwei
    };
    const result = W.signTransaction(txParams, TEST_PRIVATE_KEY, 1);
    if (!result.rawTransaction.startsWith('0x')) throw new Error('Invalid raw transaction format');
    if (!result.hash.startsWith('0x')) throw new Error('Invalid hash format');
    console.log(`  Tx Hash: ${result.hash}`);
    console.log(`  Raw: ${result.rawTransaction.slice(0, 40)}...`);
});

test('Sign EIP-1559 transaction', () => {
    const txParams = {
        to: '0x1234123451234567890d91123456789012345678',
        value: '1000000000000000000',
        nonce: 0,
        gas: 21000,
        maxFeePerGas: '30000000000',
        maxPriorityFeePerGas: '2000000000'
    };
    const result = W.signTransaction(txParams, TEST_PRIVATE_KEY, 1);
    if (!result.rawTransaction.startsWith('0x')) throw new Error('Invalid raw transaction format');
    console.log(`  EIP-1559 Tx Hash: ${result.hash}`);
});

console.log('\n--- EIP-712 TYPED DATA ---');

test('Sign typed data (EIP-712)', () => {
    const typedData = {
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' }
            ],
            Person: [
                { name: 'name', type: 'string' },
                { name: 'wallet', type: 'address' }
            ]
        },
        primaryType: 'Person',
        domain: {
            name: 'Test',
            version: '1',
            chainId: 1
        },
        message: {
            name: 'Alice',
            wallet: '0x1234123451234567890d91123456789012345678'
        }
    };
    
    const result = W.signTypedData(typedData, TEST_PRIVATE_KEY);
    if (!result.signature.startsWith('0x')) throw new Error('Invalid signature format');
    console.log(`  Typed Data Signature: ${result.signature.slice(0, 40)}...`);
});

test('Verify typed data signature', () => {
    const typedData = {
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' }
            ],
            Message: [
                { name: 'content', type: 'string' }
            ]
        },
        primaryType: 'Message',
        domain: { name: 'Test', version: '1', chainId: 1 },
        message: { content: 'Hello' }
    };
    
    const signed = W.signTypedData(typedData, TEST_PRIVATE_KEY);
    const result = W.verifyTypedData(typedData, signed.signature, TEST_ADDRESS);
    if (!result.isValid) throw new Error('Typed data verification failed');
});

console.log('\n--- VANITY ADDRESS ---');

test('Check vanity match - prefix', () => {
    if (!W.checkVanityMatch('0xdeadbeef1234567890123456789012345678dead', { prefix: 'dead' })) {
        throw new Error('Prefix match failed');
    }
    if (W.checkVanityMatch('0x1234123451234567890d91123456789012345678', { prefix: 'dead' })) {
        throw new Error('Should not match prefix');
    }
});

test('Check vanity match - suffix', () => {
    if (!W.checkVanityMatch('0x1234123451234567890d91123456789012345678', { suffix: '7890' })) {
        throw new Error('Suffix match failed');
    }
});

test('Check vanity match - case sensitive', () => {
    if (!W.checkVanityMatch('0x1234123451234567890d91123456789012345678', { prefix: 'dead', caseSensitive: false })) {
        throw new Error('Case insensitive match failed');
    }
});

console.log('\n--- CONTRACT ADDRESS ---');

test('Calculate contract address', () => {
    // Known test case: Uniswap V2 factory deployment
    const deployer = '0x6C9FC64A53c1b71FB3f9Af64d1ae3A4931A5f4E9';
    const address = W.calculateContractAddress(deployer, 0);
    if (!address.startsWith('0x')) throw new Error('Invalid address format');
    if (address.length !== 42) throw new Error('Invalid address length');
    console.log(`  Contract at nonce 0: ${address}`);
});

test('Calculate contract address with different nonces', () => {
    const deployer = TEST_ADDRESS;
    const addr0 = W.calculateContractAddress(deployer, 0);
    const addr1 = W.calculateContractAddress(deployer, 1);
    const addr10 = W.calculateContractAddress(deployer, 10);
    if (addr0 === addr1) throw new Error('Same address for different nonces');
    console.log(`  Nonce 0: ${addr0}`);
    console.log(`  Nonce 1: ${addr1}`);
    console.log(`  Nonce 10: ${addr10}`);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
    process.exit(1);
}
