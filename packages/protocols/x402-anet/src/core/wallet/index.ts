import { ethers } from 'ethers';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface WalletData {
  address: string;
  privateKey: string;
  mnemonic?: string;
  createdAt: string;
}

export interface EncryptedWallet {
  encrypted: string;
  iv: string;
  authTag: string;
  address: string;
}

export function generateWallet(): WalletData {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase,
    createdAt: new Date().toISOString(),
  };
}

export function encryptPrivateKey(privateKey: string, password: string): string {
  const algorithm = 'aes-256-gcm';
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: authTag.toString('hex'),
  });
}

export function decryptPrivateKey(encryptedData: string, password: string): string {
  const { encrypted, iv, salt, authTag } = JSON.parse(encryptedData);
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 32);
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function saveWallet(walletData: WalletData, filePath: string, password?: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (password) {
    const encrypted = encryptPrivateKey(walletData.privateKey, password);
    const data: EncryptedWallet = {
      ...JSON.parse(encrypted),
      address: walletData.address,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  } else {
    fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2), { mode: 0o600 });
  }
}

export function loadWallet(filePath: string, password?: string): WalletData {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (data.encrypted && password) {
    const privateKey = decryptPrivateKey(raw, password);
    return {
      address: data.address,
      privateKey,
      createdAt: data.createdAt || new Date().toISOString(),
    };
  }

  return data as WalletData;
}

export function walletFromPrivateKey(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey);
}
