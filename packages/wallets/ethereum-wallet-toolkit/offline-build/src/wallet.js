/**
 * Ethereum Wallet Toolkit - Browser Bundle
 * Uses official ethereumjs and ethereum-cryptography libraries
 */

// Core cryptographic primitives from ethereum-cryptography (official)
import { keccak256 } from 'ethereum-cryptography/keccak.js';
import { secp256k1 } from 'ethereum-cryptography/secp256k1.js';
import { utf8ToBytes, bytesToHex as cryptoBytesToHex, hexToBytes as cryptoHexToBytes, concatBytes } from 'ethereum-cryptography/utils.js';
import { scrypt } from 'ethereum-cryptography/scrypt.js';
import { getRandomBytesSync } from 'ethereum-cryptography/random.js';

// BIP39/BIP32 for mnemonic support  
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

// Transaction support
import { LegacyTransaction, FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Common, Chain, Hardfork } from '@ethereumjs/common';
import { RLP } from '@ethereumjs/rlp';
import { 
    privateToPublic, 
    publicToAddress, 
    toChecksumAddress,
    isValidAddress,
    isValidChecksumAddress,
    ecsign,
    ecrecover,
    hashPersonalMessage,
    bytesToHex,
    hexToBytes,
    bigIntToHex
} from '@ethereumjs/util';

// Helper functions
function stripHexPrefix(str) {
    return typeof str === 'string' && str.startsWith('0x') ? str.slice(2) : str;
}

function addHexPrefix(str) {
    return typeof str === 'string' && !str.startsWith('0x') ? '0x' + str : str;
}

// ============================================================================
// WALLET GENERATION
// ============================================================================

export function generateWallet() {
    const privateKey = getRandomBytesSync(32);
    return privateKeyToWallet(privateKey);
}

export function privateKeyToWallet(privateKey) {
    const privKeyBytes = typeof privateKey === 'string' 
        ? cryptoHexToBytes(stripHexPrefix(privateKey))
        : privateKey;
    
    const publicKey = secp256k1.getPublicKey(privKeyBytes, false).slice(1); // uncompressed, remove 04 prefix
    const addressBytes = keccak256(publicKey).slice(-20);
    const address = toChecksumAddress(addHexPrefix(cryptoBytesToHex(addressBytes)));
    
    return {
        address,
        privateKey: addHexPrefix(cryptoBytesToHex(privKeyBytes)),
        publicKey: addHexPrefix(cryptoBytesToHex(publicKey))
    };
}

// ============================================================================
// MNEMONIC / HD WALLET
// ============================================================================

export function createMnemonic(wordCount = 12) {
    const strength = { 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 }[wordCount] || 128;
    return generateMnemonic(englishWordlist, strength);
}

export function validateMnemonicPhrase(mnemonic) {
    return validateMnemonic(mnemonic, englishWordlist);
}

export function mnemonicToWallet(mnemonic, passphrase = '', path = "m/44'/60'/0'/0/0") {
    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derived = hdKey.derive(path);
    
    if (!derived.privateKey) throw new Error('Failed to derive private key');
    
    const wallet = privateKeyToWallet(derived.privateKey);
    return {
        ...wallet,
        mnemonic,
        path
    };
}

export function deriveAccounts(mnemonic, count = 10, passphrase = '', basePath = "m/44'/60'/0'/0") {
    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    const hdKey = HDKey.fromMasterSeed(seed);
    const accounts = [];
    
    for (let i = 0; i < count; i++) {
        const path = `${basePath}/${i}`;
        const derived = hdKey.derive(path);
        if (!derived.privateKey) continue;
        
        const wallet = privateKeyToWallet(derived.privateKey);
        accounts.push({ ...wallet, path, index: i });
    }
    
    return accounts;
}

// ============================================================================
// MESSAGE SIGNING (EIP-191)
// ============================================================================

export function signMessage(message, privateKey) {
    const privKeyBytes = typeof privateKey === 'string'
        ? cryptoHexToBytes(stripHexPrefix(privateKey))
        : privateKey;
    
    const messageBytes = typeof message === 'string' ? utf8ToBytes(message) : message;
    const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${messageBytes.length}`);
    const prefixedMessage = concatBytes(prefix, messageBytes);
    const messageHash = keccak256(prefixedMessage);
    
    const signature = secp256k1.sign(messageHash, privKeyBytes);
    const r = signature.r.toString(16).padStart(64, '0');
    const s = signature.s.toString(16).padStart(64, '0');
    const v = signature.recovery + 27;
    
    return {
        message: typeof message === 'string' ? message : cryptoBytesToHex(message),
        messageHash: addHexPrefix(cryptoBytesToHex(messageHash)),
        signature: addHexPrefix(r + s + v.toString(16)),
        r: addHexPrefix(r),
        s: addHexPrefix(s),
        v
    };
}

export function verifyMessage(message, signature, expectedAddress) {
    const sigBytes = cryptoHexToBytes(stripHexPrefix(signature));
    const r = sigBytes.slice(0, 32);
    const s = sigBytes.slice(32, 64);
    const v = sigBytes[64];
    
    const messageBytes = typeof message === 'string' ? utf8ToBytes(message) : message;
    const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${messageBytes.length}`);
    const prefixedMessage = concatBytes(prefix, messageBytes);
    const messageHash = keccak256(prefixedMessage);
    
    const sig = secp256k1.Signature.fromCompact(concatBytes(r, s)).addRecoveryBit(v - 27);
    const publicKey = sig.recoverPublicKey(messageHash).toRawBytes(false).slice(1);
    const addressBytes = keccak256(publicKey).slice(-20);
    const recoveredAddress = toChecksumAddress(addHexPrefix(cryptoBytesToHex(addressBytes)));
    
    return {
        message: typeof message === 'string' ? message : bytesToHex(message),
        expectedAddress,
        recoveredAddress,
        isValid: recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
    };
}

// ============================================================================
// TRANSACTION SIGNING
// ============================================================================

export function signTransaction(txParams, privateKey, chainId = 1) {
    const privKeyBytes = typeof privateKey === 'string'
        ? cryptoHexToBytes(stripHexPrefix(privateKey))
        : privateKey;
    
    const common = Common.custom({ chainId: BigInt(chainId) });
    
    let tx;
    if (txParams.maxFeePerGas) {
        // EIP-1559 transaction
        tx = FeeMarketEIP1559Transaction.fromTxData({
            to: txParams.to,
            value: BigInt(txParams.value || 0),
            nonce: BigInt(txParams.nonce || 0),
            gasLimit: BigInt(txParams.gas || 21000),
            maxFeePerGas: BigInt(txParams.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas || 0),
            data: txParams.data || '0x',
            chainId: BigInt(chainId)
        }, { common });
    } else {
        // Legacy transaction
        tx = LegacyTransaction.fromTxData({
            to: txParams.to,
            value: BigInt(txParams.value || 0),
            nonce: BigInt(txParams.nonce || 0),
            gasLimit: BigInt(txParams.gas || 21000),
            gasPrice: BigInt(txParams.gasPrice),
            data: txParams.data || '0x'
        }, { common });
    }
    
    const signedTx = tx.sign(privKeyBytes);
    const serialized = signedTx.serialize();
    
    return {
        rawTransaction: addHexPrefix(cryptoBytesToHex(serialized)),
        hash: addHexPrefix(cryptoBytesToHex(signedTx.hash())),
        r: addHexPrefix(signedTx.r.toString(16).padStart(64, '0')),
        s: addHexPrefix(signedTx.s.toString(16).padStart(64, '0')),
        v: Number(signedTx.v)
    };
}

// ============================================================================
// KEYSTORE (V3)
// ============================================================================

export async function encryptKeystore(privateKey, password) {
    const privKeyBytes = typeof privateKey === 'string'
        ? cryptoHexToBytes(stripHexPrefix(privateKey))
        : privateKey;
    
    const wallet = privateKeyToWallet(privKeyBytes);
    const salt = getRandomBytesSync(32);
    const iv = getRandomBytesSync(16);
    const uuid = getRandomBytesSync(16);
    
    // Scrypt key derivation
    const derivedKey = await scrypt(
        utf8ToBytes(password),
        salt,
        { N: 262144, r: 8, p: 1, dkLen: 32 }
    );
    
    // AES-128-CTR encryption
    const encryptionKey = derivedKey.slice(0, 16);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', encryptionKey, { name: 'AES-CTR' }, false, ['encrypt']
    );
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: iv, length: 64 },
        cryptoKey,
        privKeyBytes
    ));
    
    // MAC
    const macData = concatBytes(derivedKey.slice(16), ciphertext);
    const mac = keccak256(macData);
    
    const id = cryptoBytesToHex(uuid);
    
    return {
        version: 3,
        id: `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`,
        address: wallet.address.slice(2).toLowerCase(),
        crypto: {
            ciphertext: cryptoBytesToHex(ciphertext),
            cipherparams: { iv: cryptoBytesToHex(iv) },
            cipher: 'aes-128-ctr',
            kdf: 'scrypt',
            kdfparams: {
                dklen: 32,
                salt: cryptoBytesToHex(salt),
                n: 262144,
                r: 8,
                p: 1
            },
            mac: cryptoBytesToHex(mac)
        }
    };
}

export async function decryptKeystore(keystore, password) {
    const ks = typeof keystore === 'string' ? JSON.parse(keystore) : keystore;
    
    const salt = cryptoHexToBytes(ks.crypto.kdfparams.salt);
    const iv = cryptoHexToBytes(ks.crypto.cipherparams.iv);
    const ciphertext = cryptoHexToBytes(ks.crypto.ciphertext);
    
    let derivedKey;
    if (ks.crypto.kdf === 'scrypt') {
        const { n, r, p } = ks.crypto.kdfparams;
        derivedKey = await scrypt(utf8ToBytes(password), salt, { N: n, r, p, dkLen: 32 });
    } else {
        throw new Error('Unsupported KDF: ' + ks.crypto.kdf);
    }
    
    // Verify MAC
    const macData = concatBytes(derivedKey.slice(16), ciphertext);
    const mac = cryptoBytesToHex(keccak256(macData));
    if (mac !== ks.crypto.mac) {
        throw new Error('Invalid password (MAC mismatch)');
    }
    
    // Decrypt
    const encryptionKey = derivedKey.slice(0, 16);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', encryptionKey, { name: 'AES-CTR' }, false, ['decrypt']
    );
    const decrypted = new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-CTR', counter: iv, length: 64 },
        cryptoKey,
        ciphertext
    ));
    
    return privateKeyToWallet(decrypted);
}

// ============================================================================
// EIP-712 TYPED DATA SIGNING
// ============================================================================

export function signTypedData(typedData, privateKey) {
    const privKeyBytes = typeof privateKey === 'string'
        ? cryptoHexToBytes(stripHexPrefix(privateKey))
        : privateKey;
    
    const hash = hashTypedData(typedData);
    const signature = secp256k1.sign(hash, privKeyBytes);
    const r = signature.r.toString(16).padStart(64, '0');
    const s = signature.s.toString(16).padStart(64, '0');
    const v = signature.recovery + 27;
    
    return {
        messageHash: addHexPrefix(cryptoBytesToHex(hash)),
        signature: addHexPrefix(r + s + v.toString(16)),
        r: addHexPrefix(r),
        s: addHexPrefix(s),
        v
    };
}

function hashTypedData(typedData) {
    const { domain, types, message, primaryType } = typedData;
    
    const domainType = [];
    if (domain.name) domainType.push({ name: 'name', type: 'string' });
    if (domain.version) domainType.push({ name: 'version', type: 'string' });
    if (domain.chainId !== undefined) domainType.push({ name: 'chainId', type: 'uint256' });
    if (domain.verifyingContract) domainType.push({ name: 'verifyingContract', type: 'address' });
    if (domain.salt) domainType.push({ name: 'salt', type: 'bytes32' });
    
    const allTypes = { EIP712Domain: domainType, ...types };
    
    function encodeType(name) {
        const deps = new Set();
        function findDeps(t) {
            if (deps.has(t) || !allTypes[t]) return;
            deps.add(t);
            allTypes[t].forEach(f => {
                const baseType = f.type.replace(/\[\d*\]$/, '');
                if (allTypes[baseType]) findDeps(baseType);
            });
        }
        findDeps(name);
        deps.delete(name);
        const sorted = [name, ...[...deps].sort()];
        return sorted.map(t => `${t}(${allTypes[t].map(f => `${f.type} ${f.name}`).join(',')})`).join('');
    }
    
    function typeHash(name) {
        return keccak256(utf8ToBytes(encodeType(name)));
    }
    
    function encodeValue(type, value) {
        if (type === 'string') return keccak256(utf8ToBytes(value));
        if (type === 'bytes') return keccak256(cryptoHexToBytes(stripHexPrefix(value)));
        if (type === 'bool') return new Uint8Array(32).fill(0).map((_, i) => i === 31 ? (value ? 1 : 0) : 0);
        if (type === 'address') {
            const addr = cryptoHexToBytes(stripHexPrefix(value).padStart(40, '0'));
            const padded = new Uint8Array(32);
            padded.set(addr, 12);
            return padded;
        }
        if (type.startsWith('uint') || type.startsWith('int')) {
            const n = BigInt(value);
            const hex = n.toString(16).padStart(64, '0');
            return cryptoHexToBytes(hex);
        }
        if (type.startsWith('bytes')) {
            const padded = new Uint8Array(32);
            const data = cryptoHexToBytes(stripHexPrefix(value));
            padded.set(data.slice(0, 32));
            return padded;
        }
        if (allTypes[type]) return encodeData(type, value);
        return new Uint8Array(32);
    }
    
    function encodeData(type, data) {
        const values = [typeHash(type)];
        for (const field of allTypes[type]) {
            values.push(encodeValue(field.type, data[field.name]));
        }
        return keccak256(concatBytes(...values));
    }
    
    const domainSeparator = encodeData('EIP712Domain', domain);
    const structHash = encodeData(primaryType, message);
    
    return keccak256(concatBytes(
        new Uint8Array([0x19, 0x01]),
        domainSeparator,
        structHash
    ));
}

export function verifyTypedData(typedData, signature, expectedAddress) {
    const hash = hashTypedData(typedData);
    const sigBytes = cryptoHexToBytes(stripHexPrefix(signature));
    const r = sigBytes.slice(0, 32);
    const s = sigBytes.slice(32, 64);
    const v = sigBytes[64];
    
    const sig = secp256k1.Signature.fromCompact(concatBytes(r, s)).addRecoveryBit(v - 27);
    const publicKey = sig.recoverPublicKey(hash).toRawBytes(false).slice(1);
    const addressBytes = keccak256(publicKey).slice(-20);
    const recoveredAddress = toChecksumAddress(addHexPrefix(cryptoBytesToHex(addressBytes)));
    
    return {
        expectedAddress,
        recoveredAddress,
        isValid: recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
    };
}

// ============================================================================
// VANITY ADDRESS GENERATION
// ============================================================================

export function checkVanityMatch(address, options) {
    const addr = address.slice(2);
    const check = options.caseSensitive ? addr : addr.toLowerCase();
    
    if (options.prefix) {
        const p = options.caseSensitive ? options.prefix : options.prefix.toLowerCase();
        if (!check.startsWith(p)) return false;
    }
    if (options.suffix) {
        const s = options.caseSensitive ? options.suffix : options.suffix.toLowerCase();
        if (!check.endsWith(s)) return false;
    }
    if (options.contains) {
        const c = options.caseSensitive ? options.contains : options.contains.toLowerCase();
        if (!check.includes(c)) return false;
    }
    if (options.letters && !/^[a-f]+$/i.test(addr)) return false;
    if (options.numbers && !/^[0-9]+$/.test(addr)) return false;
    if (options.regex) {
        try {
            if (!new RegExp(options.regex, options.caseSensitive ? '' : 'i').test(check)) return false;
        } catch { return false; }
    }
    if (options.mirror) {
        const half = Math.floor(check.length / 2);
        if (check.slice(0, half) !== check.slice(-half).split('').reverse().join('')) return false;
    }
    if (options.doubles) {
        let count = 0;
        for (let i = 0; i < check.length - 1; i += 2) {
            if (check[i] === check[i + 1]) count++; else break;
        }
        if (count < 2) return false;
    }
    if (options.zeros && (check.match(/0/g) || []).length < 8) return false;
    if (options.leading && options.leadingCount > 0) {
        const expected = (options.caseSensitive ? options.leading : options.leading.toLowerCase()).repeat(options.leadingCount);
        if (!check.startsWith(expected)) return false;
    }
    
    return true;
}

export function calculateContractAddress(deployerAddress, nonce = 0) {
    const addrBytes = cryptoHexToBytes(stripHexPrefix(deployerAddress));
    const nonceBytes = nonce === 0 
        ? new Uint8Array([0x80])
        : cryptoHexToBytes(nonce.toString(16).padStart(2, '0'));
    
    // RLP encode [address, nonce]
    const rlpEncoded = RLP.encode([addrBytes, nonce === 0 ? new Uint8Array() : nonceBytes]);
    const hash = keccak256(rlpEncoded);
    return toChecksumAddress(addHexPrefix(cryptoBytesToHex(hash.slice(-20))));
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateAddress(address) {
    if (!address || !address.startsWith('0x') || address.length !== 42) return false;
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function validatePrivateKey(key) {
    const k = stripHexPrefix(key);
    if (k.length !== 64) return false;
    return /^[0-9a-fA-F]{64}$/.test(k);
}

export function validateKeyAddressPair(privateKey, address) {
    if (!validatePrivateKey(privateKey)) return false;
    const wallet = privateKeyToWallet(privateKey);
    return wallet.address.toLowerCase() === address.toLowerCase();
}

// ============================================================================
// UTILITIES
// ============================================================================

export { 
    cryptoBytesToHex as bytesToHex, 
    cryptoHexToBytes as hexToBytes, 
    utf8ToBytes,
    toChecksumAddress,
    keccak256
};
