#!/usr/bin/env node
/**
 * Build script to create offline1.html with bundled official ethereumjs libraries
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// HTML template with pure black/white theme
const htmlTemplate = (bundledJS) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ethereum Wallet Toolkit (Offline)</title>
    <style>
        :root { --bg: #000; --fg: #fff; --border: #333; --muted: #888; }
        .light-mode { --bg: #fff; --fg: #000; --border: #ccc; --muted: #666; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: var(--bg); color: var(--fg); min-height: 100vh; padding: 1rem; transition: background 0.2s, color 0.2s; }
        .container { max-width: 800px; margin: 0 auto; }
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
        h1 { font-size: 1.25rem; font-weight: 600; }
        .theme-toggle { background: none; border: 1px solid var(--border); color: var(--fg); padding: 0.5rem; cursor: pointer; font-size: 1rem; }
        .warning { border: 1px solid var(--border); padding: 0.75rem; margin-bottom: 1rem; font-size: 0.8rem; }
        .tabs { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
        .tab { background: none; border: 1px solid var(--border); color: var(--muted); padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.75rem; transition: all 0.2s; }
        .tab:hover { color: var(--fg); }
        .tab.active { background: var(--fg); color: var(--bg); }
        .panel { display: none; }
        .panel.active { display: block; }
        .card { border: 1px solid var(--border); padding: 1rem; margin-bottom: 1rem; }
        .card-title { font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
        label { display: block; margin-bottom: 0.25rem; color: var(--muted); font-size: 0.75rem; text-transform: uppercase; }
        input, textarea, select { width: 100%; padding: 0.5rem; border: 1px solid var(--border); background: var(--bg); color: var(--fg); font-family: monospace; font-size: 0.85rem; margin-bottom: 0.75rem; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--fg); }
        textarea { resize: vertical; min-height: 80px; }
        button { padding: 0.6rem 1rem; border: 1px solid var(--fg); background: var(--fg); color: var(--bg); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.1s; }
        button:hover { opacity: 0.9; }
        button:active { transform: scale(0.98); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: var(--bg); color: var(--fg); }
        .btn-small { padding: 0.3rem 0.6rem; font-size: 0.7rem; }
        .btn-group { display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
        .row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .row > * { flex: 1; min-width: 200px; }
        .checkbox-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .checkbox-row input { width: auto; margin: 0; }
        .checkbox-row label { margin: 0; text-transform: none; color: var(--fg); }
        .result { margin-top: 1rem; padding: 1rem; border: 1px solid var(--border); background: var(--bg); }
        .result-title { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; margin-bottom: 0.25rem; }
        .result-value { font-family: monospace; font-size: 0.8rem; word-break: break-all; padding: 0.5rem; border: 1px solid var(--border); margin-bottom: 0.75rem; background: var(--bg); }
        .status { color: var(--muted); font-size: 0.8rem; margin-top: 0.5rem; }
        .hidden { display: none !important; }
        .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; }
        footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.7rem; }
        footer a { color: var(--fg); }
        @media (max-width: 600px) { .tabs { gap: 0.15rem; } .tab { padding: 0.4rem 0.5rem; font-size: 0.65rem; } }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>⟠ Ethereum Wallet Toolkit</h1>
            <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">◐</button>
        </header>

        <div class="warning">
            <strong>⚠ OFFLINE USE:</strong> Disconnect from internet before use. Save page (Ctrl+S) for offline access. Never share private keys.<br>
            <small>Built with official ethereumjs libraries</small>
        </div>

        <div class="tabs">
            <button class="tab active" data-panel="generate">Generate</button>
            <button class="tab" data-panel="mnemonic">Mnemonic</button>
            <button class="tab" data-panel="vanity">Vanity</button>
            <button class="tab" data-panel="sign">Sign</button>
            <button class="tab" data-panel="verify">Verify</button>
            <button class="tab" data-panel="validate">Validate</button>
            <button class="tab" data-panel="keystore">Keystore</button>
            <button class="tab" data-panel="transaction">Transaction</button>
            <button class="tab" data-panel="typed-data">EIP-712</button>
        </div>

        <!-- GENERATE PANEL -->
        <div class="panel active" id="panel-generate">
            <div class="card">
                <div class="card-title">Generate Random Wallet</div>
                <button onclick="generateWallet()">Generate New Wallet</button>
                <div id="generate-result" class="result hidden"></div>
            </div>
        </div>

        <!-- MNEMONIC PANEL -->
        <div class="panel" id="panel-mnemonic">
            <div class="card">
                <div class="card-title">Create Wallet with Mnemonic</div>
                <div class="row">
                    <div>
                        <label>Word Count</label>
                        <select id="mnemonic-words">
                            <option value="12">12 words</option>
                            <option value="15">15 words</option>
                            <option value="18">18 words</option>
                            <option value="21">21 words</option>
                            <option value="24">24 words</option>
                        </select>
                    </div>
                    <div>
                        <label>Passphrase (optional)</label>
                        <input type="text" id="mnemonic-passphrase" placeholder="Optional BIP39 passphrase">
                    </div>
                </div>
                <label>Derivation Path</label>
                <input type="text" id="mnemonic-path" value="m/44'/60'/0'/0/0">
                <button onclick="createWithMnemonic()">Create with Mnemonic</button>
                <div id="mnemonic-create-result" class="result hidden"></div>
            </div>

            <div class="card">
                <div class="card-title">Restore from Mnemonic</div>
                <label>Mnemonic Phrase</label>
                <textarea id="restore-mnemonic" placeholder="Enter your 12-24 word mnemonic phrase"></textarea>
                <div class="row">
                    <div>
                        <label>Passphrase (optional)</label>
                        <input type="text" id="restore-passphrase" placeholder="Optional passphrase">
                    </div>
                    <div>
                        <label>Derivation Path</label>
                        <input type="text" id="restore-path" value="m/44'/60'/0'/0/0">
                    </div>
                </div>
                <button onclick="restoreFromMnemonic()">Restore Wallet</button>
                <div id="mnemonic-restore-result" class="result hidden"></div>
            </div>

            <div class="card">
                <div class="card-title">Restore from Private Key</div>
                <label>Private Key</label>
                <input type="text" id="restore-key" placeholder="0x...">
                <button onclick="restoreFromKey()">Restore from Key</button>
                <div id="key-restore-result" class="result hidden"></div>
            </div>

            <div class="card">
                <div class="card-title">Derive Multiple Accounts</div>
                <label>Mnemonic Phrase</label>
                <textarea id="derive-mnemonic" placeholder="Enter mnemonic phrase"></textarea>
                <div class="row">
                    <div>
                        <label>Number of Accounts</label>
                        <input type="number" id="derive-count" value="5" min="1" max="100">
                    </div>
                    <div>
                        <label>Base Path</label>
                        <input type="text" id="derive-base-path" value="m/44'/60'/0'/0">
                    </div>
                </div>
                <button onclick="deriveAccounts()">Derive Accounts</button>
                <div id="derive-result" class="result hidden"></div>
            </div>
        </div>

        <!-- VANITY PANEL -->
        <div class="panel" id="panel-vanity">
            <div class="card">
                <div class="card-title">Vanity Address Generator</div>
                <div class="row">
                    <div>
                        <label>Prefix (after 0x)</label>
                        <input type="text" id="vanity-prefix" placeholder="e.g., dead" maxlength="8">
                    </div>
                    <div>
                        <label>Suffix</label>
                        <input type="text" id="vanity-suffix" placeholder="e.g., beef" maxlength="8">
                    </div>
                </div>
                <label>Contains</label>
                <input type="text" id="vanity-contains" placeholder="Address must contain this pattern">
                <label>Regex Pattern</label>
                <input type="text" id="vanity-regex" placeholder="e.g., ^dead.*beef$">
                
                <div class="grid-2" style="margin: 0.75rem 0;">
                    <div class="checkbox-row">
                        <input type="checkbox" id="vanity-case">
                        <label for="vanity-case">Case-sensitive (EIP-55)</label>
                    </div>
                    <div class="checkbox-row">
                        <input type="checkbox" id="vanity-letters">
                        <label for="vanity-letters">Letters only (a-f)</label>
                    </div>
                    <div class="checkbox-row">
                        <input type="checkbox" id="vanity-numbers">
                        <label for="vanity-numbers">Numbers only (0-9)</label>
                    </div>
                    <div class="checkbox-row">
                        <input type="checkbox" id="vanity-mirror">
                        <label for="vanity-mirror">Mirror/Palindrome</label>
                    </div>
                    <div class="checkbox-row">
                        <input type="checkbox" id="vanity-doubles">
                        <label for="vanity-doubles">Leading doubles</label>
                    </div>
                    <div class="checkbox-row">
                        <input type="checkbox" id="vanity-zeros">
                        <label for="vanity-zeros">Many zeros (8+)</label>
                    </div>
                    <div class="checkbox-row">
                        <input type="checkbox" id="vanity-contract">
                        <label for="vanity-contract">Contract address</label>
                    </div>
                </div>
                
                <div class="row">
                    <div>
                        <label>Leading Character</label>
                        <input type="text" id="vanity-leading" placeholder="e.g., 0" maxlength="1">
                    </div>
                    <div>
                        <label>Leading Count</label>
                        <input type="number" id="vanity-leading-count" value="4" min="1" max="20">
                    </div>
                </div>
                
                <div class="btn-group">
                    <button id="vanity-btn" onclick="startVanity()">Start Mining</button>
                    <button class="btn-secondary" onclick="stopVanity()">Stop</button>
                </div>
                <p class="status" id="vanity-status"></p>
                <div id="vanity-result" class="result hidden"></div>
            </div>
        </div>

        <!-- SIGN PANEL -->
        <div class="panel" id="panel-sign">
            <div class="card">
                <div class="card-title">Sign Message</div>
                <label>Message</label>
                <textarea id="sign-message" placeholder="Enter message to sign"></textarea>
                <label>Private Key</label>
                <input type="text" id="sign-key" placeholder="0x...">
                <button onclick="signMessageUI()">Sign Message</button>
                <div id="sign-result" class="result hidden"></div>
            </div>
        </div>

        <!-- VERIFY PANEL -->
        <div class="panel" id="panel-verify">
            <div class="card">
                <div class="card-title">Verify Message Signature</div>
                <label>Message</label>
                <textarea id="verify-message" placeholder="Original message"></textarea>
                <label>Signature</label>
                <input type="text" id="verify-signature" placeholder="0x...">
                <label>Expected Address</label>
                <input type="text" id="verify-address" placeholder="0x...">
                <button onclick="verifyMessageUI()">Verify Signature</button>
                <div id="verify-result" class="result hidden"></div>
            </div>
        </div>

        <!-- VALIDATE PANEL -->
        <div class="panel" id="panel-validate">
            <div class="card">
                <div class="card-title">Validate Address</div>
                <label>Ethereum Address</label>
                <input type="text" id="validate-address" placeholder="0x...">
                <button onclick="validateAddressUI()">Validate Address</button>
                <div id="validate-address-result" class="result hidden"></div>
            </div>

            <div class="card">
                <div class="card-title">Validate Private Key</div>
                <label>Private Key</label>
                <input type="text" id="validate-key" placeholder="0x...">
                <button onclick="validateKeyUI()">Validate Key</button>
                <div id="validate-key-result" class="result hidden"></div>
            </div>

            <div class="card">
                <div class="card-title">Verify Key-Address Pair</div>
                <label>Private Key</label>
                <input type="text" id="pair-key" placeholder="0x...">
                <label>Address</label>
                <input type="text" id="pair-address" placeholder="0x...">
                <button onclick="validatePairUI()">Verify Match</button>
                <div id="pair-result" class="result hidden"></div>
            </div>
        </div>

        <!-- KEYSTORE PANEL -->
        <div class="panel" id="panel-keystore">
            <div class="card">
                <div class="card-title">Encrypt to Keystore</div>
                <label>Private Key</label>
                <input type="text" id="keystore-encrypt-key" placeholder="0x...">
                <label>Password</label>
                <input type="password" id="keystore-encrypt-password" placeholder="Strong password">
                <label>Confirm Password</label>
                <input type="password" id="keystore-encrypt-confirm" placeholder="Confirm password">
                <button onclick="encryptKeystoreUI()">Encrypt to Keystore</button>
                <div id="keystore-encrypt-result" class="result hidden"></div>
            </div>

            <div class="card">
                <div class="card-title">Decrypt Keystore</div>
                <label>Keystore JSON</label>
                <textarea id="keystore-decrypt-json" placeholder="Paste keystore JSON here"></textarea>
                <label>Password</label>
                <input type="password" id="keystore-decrypt-password" placeholder="Keystore password">
                <button onclick="decryptKeystoreUI()">Decrypt Keystore</button>
                <div id="keystore-decrypt-result" class="result hidden"></div>
            </div>
        </div>

        <!-- TRANSACTION PANEL -->
        <div class="panel" id="panel-transaction">
            <div class="card">
                <div class="card-title">Sign Transaction Offline</div>
                <div class="row">
                    <div>
                        <label>To Address</label>
                        <input type="text" id="tx-to" placeholder="0x...">
                    </div>
                    <div>
                        <label>Value (Wei)</label>
                        <input type="text" id="tx-value" placeholder="0" value="0">
                    </div>
                </div>
                <div class="row">
                    <div>
                        <label>Nonce</label>
                        <input type="number" id="tx-nonce" placeholder="0" value="0" min="0">
                    </div>
                    <div>
                        <label>Gas Limit</label>
                        <input type="number" id="tx-gas" placeholder="21000" value="21000">
                    </div>
                    <div>
                        <label>Chain ID</label>
                        <input type="number" id="tx-chainid" placeholder="1" value="1">
                    </div>
                </div>
                <div class="row">
                    <div>
                        <label>Gas Price (Wei) - Legacy</label>
                        <input type="text" id="tx-gasprice" placeholder="e.g., 20000000000">
                    </div>
                </div>
                <p style="color: var(--muted); font-size: 0.75rem; margin-bottom: 0.5rem;">— OR use EIP-1559 —</p>
                <div class="row">
                    <div>
                        <label>Max Fee Per Gas (Wei)</label>
                        <input type="text" id="tx-maxfee" placeholder="EIP-1559">
                    </div>
                    <div>
                        <label>Max Priority Fee (Wei)</label>
                        <input type="text" id="tx-priorityfee" placeholder="EIP-1559">
                    </div>
                </div>
                <label>Data (hex)</label>
                <input type="text" id="tx-data" placeholder="0x" value="0x">
                <label>Private Key</label>
                <input type="text" id="tx-key" placeholder="0x...">
                <button onclick="signTransactionUI()">Sign Transaction</button>
                <div id="tx-result" class="result hidden"></div>
            </div>
        </div>

        <!-- EIP-712 TYPED DATA PANEL -->
        <div class="panel" id="panel-typed-data">
            <div class="card">
                <div class="card-title">Sign EIP-712 Typed Data</div>
                <label>Typed Data JSON</label>
                <textarea id="typed-data-json" placeholder='{"domain":{...},"types":{...},"message":{...},"primaryType":"..."}'></textarea>
                <label>Private Key</label>
                <input type="text" id="typed-data-key" placeholder="0x...">
                <button onclick="signTypedDataUI()">Sign Typed Data</button>
                <div id="typed-data-sign-result" class="result hidden"></div>
            </div>

            <div class="card">
                <div class="card-title">Verify EIP-712 Signature</div>
                <label>Typed Data JSON</label>
                <textarea id="typed-verify-json" placeholder='{"domain":{...},"types":{...},"message":{...},"primaryType":"..."}'></textarea>
                <label>Signature</label>
                <input type="text" id="typed-verify-sig" placeholder="0x...">
                <label>Expected Address</label>
                <input type="text" id="typed-verify-address" placeholder="0x...">
                <button onclick="verifyTypedDataUI()">Verify Signature</button>
                <div id="typed-data-verify-result" class="result hidden"></div>
            </div>
        </div>

        <footer>
            Ethereum Wallet Toolkit — Built with official ethereumjs libraries — <a href="https://github.com/nirholas/ethereum-wallet-toolkit">GitHub</a>
        </footer>
    </div>

    <!-- Bundled ethereumjs libraries -->
    <script>
${bundledJS}
    </script>

    <!-- UI Logic -->
    <script>
    const W = window.EthWallet;

    function copyText(t) { navigator.clipboard.writeText(t).catch(() => {}); }
    function showResult(id, html) { const el = document.getElementById(id); el.innerHTML = html; el.classList.remove('hidden'); }
    function field(label, value, copy = true) {
        const btn = copy ? \`<button class="btn-small btn-secondary" onclick="copyText('\${value.replace(/'/g, "\\\\'")}')">Copy</button>\` : '';
        return \`<div class="result-title">\${label}</div><div class="result-value">\${value}</div>\${btn}\`;
    }

    // Theme
    function toggleTheme() { document.body.classList.toggle('light-mode'); localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark'); }
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
        });
    });

    // Generate
    function generateWallet() {
        const wallet = W.generateWallet();
        showResult('generate-result', field('Address', wallet.address) + field('Private Key', wallet.privateKey));
    }

    // Mnemonic Create
    function createWithMnemonic() {
        try {
            const wordCount = parseInt(document.getElementById('mnemonic-words').value);
            const passphrase = document.getElementById('mnemonic-passphrase').value;
            const path = document.getElementById('mnemonic-path').value;
            const mnemonic = W.createMnemonic(wordCount);
            const wallet = W.mnemonicToWallet(mnemonic, passphrase, path);
            showResult('mnemonic-create-result', 
                field('Mnemonic', wallet.mnemonic) + 
                field('Address', wallet.address) + 
                field('Private Key', wallet.privateKey) +
                field('Path', wallet.path, false));
        } catch (e) { showResult('mnemonic-create-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Mnemonic Restore
    function restoreFromMnemonic() {
        try {
            const mnemonic = document.getElementById('restore-mnemonic').value.trim();
            const passphrase = document.getElementById('restore-passphrase').value;
            const path = document.getElementById('restore-path').value;
            if (!W.validateMnemonicPhrase(mnemonic)) throw new Error('Invalid mnemonic phrase');
            const wallet = W.mnemonicToWallet(mnemonic, passphrase, path);
            showResult('mnemonic-restore-result', field('Address', wallet.address) + field('Private Key', wallet.privateKey) + field('Path', wallet.path, false));
        } catch (e) { showResult('mnemonic-restore-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Key Restore
    function restoreFromKey() {
        try {
            const key = document.getElementById('restore-key').value.trim();
            if (!W.validatePrivateKey(key)) throw new Error('Invalid private key');
            const wallet = W.privateKeyToWallet(key);
            showResult('key-restore-result', field('Address', wallet.address) + field('Private Key', wallet.privateKey));
        } catch (e) { showResult('key-restore-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Derive Accounts
    function deriveAccounts() {
        try {
            const mnemonic = document.getElementById('derive-mnemonic').value.trim();
            const count = parseInt(document.getElementById('derive-count').value) || 5;
            const basePath = document.getElementById('derive-base-path').value;
            if (!W.validateMnemonicPhrase(mnemonic)) throw new Error('Invalid mnemonic phrase');
            const accounts = W.deriveAccounts(mnemonic, count, '', basePath);
            let html = '';
            accounts.forEach((a, i) => {
                html += \`<div style="margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);">
                    <strong>[\${i}]</strong> \${a.address}<br>
                    <small style="color:var(--muted)">\${a.path}</small>
                </div>\`;
            });
            showResult('derive-result', html);
        } catch (e) { showResult('derive-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Vanity
    let vanityRunning = false;
    function stopVanity() { vanityRunning = false; }
    function startVanity() {
        const opts = {
            prefix: document.getElementById('vanity-prefix').value.trim(),
            suffix: document.getElementById('vanity-suffix').value.trim(),
            contains: document.getElementById('vanity-contains').value.trim(),
            regex: document.getElementById('vanity-regex').value.trim(),
            caseSensitive: document.getElementById('vanity-case').checked,
            letters: document.getElementById('vanity-letters').checked,
            numbers: document.getElementById('vanity-numbers').checked,
            mirror: document.getElementById('vanity-mirror').checked,
            doubles: document.getElementById('vanity-doubles').checked,
            zeros: document.getElementById('vanity-zeros').checked,
            contract: document.getElementById('vanity-contract').checked,
            leading: document.getElementById('vanity-leading').value.trim(),
            leadingCount: parseInt(document.getElementById('vanity-leading-count').value) || 4
        };
        if (!opts.prefix && !opts.suffix && !opts.contains && !opts.regex && !opts.letters && !opts.numbers && !opts.mirror && !opts.doubles && !opts.zeros && !opts.leading) {
            document.getElementById('vanity-status').textContent = 'Specify at least one criteria';
            return;
        }
        vanityRunning = true;
        document.getElementById('vanity-btn').disabled = true;
        const statusEl = document.getElementById('vanity-status');
        const startTime = performance.now();
        let attempts = 0;
        const mine = () => {
            for (let i = 0; i < 100; i++) {
                attempts++;
                const wallet = W.generateWallet();
                const checkAddr = opts.contract ? W.calculateContractAddress(wallet.address, 0) : wallet.address;
                if (W.checkVanityMatch(checkAddr, opts)) {
                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                    let html = opts.contract 
                        ? field('Contract Address', checkAddr) + field('Deployer', wallet.address) + field('Deployer Key', wallet.privateKey)
                        : field('Address', wallet.address) + field('Private Key', wallet.privateKey);
                    html += \`<div class="result-title">Stats</div><div class="result-value">Time: \${elapsed}s | Attempts: \${attempts.toLocaleString()}</div>\`;
                    showResult('vanity-result', html);
                    statusEl.textContent = 'Found!';
                    document.getElementById('vanity-btn').disabled = false;
                    vanityRunning = false;
                    return;
                }
            }
            statusEl.textContent = \`Mining... \${attempts.toLocaleString()} attempts\`;
            if (vanityRunning) setTimeout(mine, 0);
            else { document.getElementById('vanity-btn').disabled = false; statusEl.textContent = 'Stopped'; }
        };
        setTimeout(mine, 10);
    }

    // Sign Message
    function signMessageUI() {
        try {
            const message = document.getElementById('sign-message').value;
            const key = document.getElementById('sign-key').value.trim();
            if (!message) throw new Error('Enter a message');
            if (!W.validatePrivateKey(key)) throw new Error('Invalid private key');
            const result = W.signMessage(message, key);
            const wallet = W.privateKeyToWallet(key);
            showResult('sign-result', field('Signer', wallet.address) + field('Signature', result.signature) + field('Message Hash', result.messageHash) + field('r', result.r) + field('s', result.s) + \`<div class="result-title">v</div><div class="result-value">\${result.v}</div>\`);
        } catch (e) { showResult('sign-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Verify Message
    function verifyMessageUI() {
        try {
            const message = document.getElementById('verify-message').value;
            const sig = document.getElementById('verify-signature').value.trim();
            const addr = document.getElementById('verify-address').value.trim();
            if (!message || !sig || !addr) throw new Error('Fill all fields');
            const result = W.verifyMessage(message, sig, addr);
            showResult('verify-result', \`<div class="result-title">Valid</div><div class="result-value">\${result.isValid ? 'YES' : 'NO'}</div>\` + field('Recovered', result.recoveredAddress) + field('Expected', result.expectedAddress));
        } catch (e) { showResult('verify-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Validate Address
    function validateAddressUI() {
        const addr = document.getElementById('validate-address').value.trim();
        const valid = W.validateAddress(addr);
        showResult('validate-address-result', \`<div class="result-title">Valid</div><div class="result-value">\${valid ? 'YES' : 'NO'}</div>\`);
    }

    // Validate Key
    function validateKeyUI() {
        const key = document.getElementById('validate-key').value.trim();
        const valid = W.validatePrivateKey(key);
        let html = \`<div class="result-title">Valid</div><div class="result-value">\${valid ? 'YES' : 'NO'}</div>\`;
        if (valid) { const wallet = W.privateKeyToWallet(key); html += field('Derived Address', wallet.address); }
        showResult('validate-key-result', html);
    }

    // Validate Pair
    function validatePairUI() {
        const key = document.getElementById('pair-key').value.trim();
        const addr = document.getElementById('pair-address').value.trim();
        if (!W.validatePrivateKey(key)) return showResult('pair-result', '<div class="error">Invalid private key</div>');
        if (!W.validateAddress(addr)) return showResult('pair-result', '<div class="error">Invalid address</div>');
        const match = W.validateKeyAddressPair(key, addr);
        const wallet = W.privateKeyToWallet(key);
        showResult('pair-result', \`<div class="result-title">Match</div><div class="result-value">\${match ? 'YES' : 'NO'}</div>\` + field('Derived Address', wallet.address));
    }

    // Keystore Encrypt
    async function encryptKeystoreUI() {
        try {
            const key = document.getElementById('keystore-encrypt-key').value.trim();
            const pw = document.getElementById('keystore-encrypt-password').value;
            const confirm = document.getElementById('keystore-encrypt-confirm').value;
            if (!W.validatePrivateKey(key)) throw new Error('Invalid private key');
            if (pw.length < 8) throw new Error('Password must be at least 8 characters');
            if (pw !== confirm) throw new Error('Passwords do not match');
            const ks = await W.encryptKeystore(key, pw);
            const json = JSON.stringify(ks, null, 2);
            showResult('keystore-encrypt-result', field('Address', '0x' + ks.address) + \`<div class="result-title">Keystore JSON</div><div class="result-value" style="white-space:pre-wrap;font-size:0.7rem;">\${json}</div><button class="btn-small btn-secondary" onclick="copyText(\\\`\${json.replace(/\`/g,'\\\\\\`')}\\\`)">Copy JSON</button>\`);
        } catch (e) { showResult('keystore-encrypt-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Keystore Decrypt
    async function decryptKeystoreUI() {
        try {
            const json = document.getElementById('keystore-decrypt-json').value.trim();
            const pw = document.getElementById('keystore-decrypt-password').value;
            if (!json || !pw) throw new Error('Enter keystore JSON and password');
            const wallet = await W.decryptKeystore(json, pw);
            showResult('keystore-decrypt-result', field('Address', wallet.address) + field('Private Key', wallet.privateKey));
        } catch (e) { showResult('keystore-decrypt-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Sign Transaction
    function signTransactionUI() {
        try {
            const to = document.getElementById('tx-to').value.trim();
            const value = document.getElementById('tx-value').value.trim() || '0';
            const nonce = parseInt(document.getElementById('tx-nonce').value) || 0;
            const gas = parseInt(document.getElementById('tx-gas').value) || 21000;
            const chainId = parseInt(document.getElementById('tx-chainid').value) || 1;
            const gasPrice = document.getElementById('tx-gasprice').value.trim();
            const maxFee = document.getElementById('tx-maxfee').value.trim();
            const priorityFee = document.getElementById('tx-priorityfee').value.trim();
            const data = document.getElementById('tx-data').value.trim() || '0x';
            const key = document.getElementById('tx-key').value.trim();
            if (!W.validateAddress(to)) throw new Error('Invalid To address');
            if (!W.validatePrivateKey(key)) throw new Error('Invalid private key');
            if (!gasPrice && !maxFee) throw new Error('Specify gas price or max fee');
            const txParams = { to, value, nonce, gas, data };
            if (maxFee) { txParams.maxFeePerGas = maxFee; txParams.maxPriorityFeePerGas = priorityFee || '0'; }
            else { txParams.gasPrice = gasPrice; }
            const result = W.signTransaction(txParams, key, chainId);
            showResult('tx-result', field('Transaction Hash', result.hash) + field('Raw Transaction', result.rawTransaction) + field('r', result.r) + field('s', result.s) + \`<div class="result-title">v</div><div class="result-value">\${result.v}</div>\`);
        } catch (e) { showResult('tx-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Sign Typed Data
    function signTypedDataUI() {
        try {
            const json = document.getElementById('typed-data-json').value.trim();
            const key = document.getElementById('typed-data-key').value.trim();
            if (!json) throw new Error('Enter typed data JSON');
            if (!W.validatePrivateKey(key)) throw new Error('Invalid private key');
            const typedData = JSON.parse(json);
            const result = W.signTypedData(typedData, key);
            const wallet = W.privateKeyToWallet(key);
            showResult('typed-data-sign-result', field('Signer', wallet.address) + field('Signature', result.signature) + field('Message Hash', result.messageHash));
        } catch (e) { showResult('typed-data-sign-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }

    // Verify Typed Data
    function verifyTypedDataUI() {
        try {
            const json = document.getElementById('typed-verify-json').value.trim();
            const sig = document.getElementById('typed-verify-sig').value.trim();
            const addr = document.getElementById('typed-verify-address').value.trim();
            if (!json || !sig || !addr) throw new Error('Fill all fields');
            const typedData = JSON.parse(json);
            const result = W.verifyTypedData(typedData, sig, addr);
            showResult('typed-data-verify-result', \`<div class="result-title">Valid</div><div class="result-value">\${result.isValid ? 'YES' : 'NO'}</div>\` + field('Recovered', result.recoveredAddress) + field('Expected', result.expectedAddress));
        } catch (e) { showResult('typed-data-verify-result', '<div class="error">Error: ' + e.message + '</div>'); }
    }
    </script>
</body>
</html>`;

async function build() {
    console.log('Building offline1.html with official ethereumjs libraries...\n');

    // Bundle the wallet module
    console.log('1. Bundling ethereumjs libraries...');
    const result = await esbuild.build({
        entryPoints: [path.join(__dirname, 'src/wallet.js')],
        bundle: true,
        minify: true,
        format: 'iife',
        globalName: 'EthWallet',
        write: false,
        target: 'es2020',
        platform: 'browser',
        define: {
            'process.env.NODE_ENV': '"production"'
        }
    });

    const bundledJS = new TextDecoder().decode(result.outputFiles[0].contents);
    console.log(`   Bundle size: ${(bundledJS.length / 1024).toFixed(2)} KB\n`);

    // Generate the HTML file
    console.log('2. Generating offline1.html...');
    const html = htmlTemplate(bundledJS);
    
    // Ensure dist directory exists
    const distDir = path.join(__dirname, '..', '');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const outputPath = path.join(distDir, 'offline1.html');
    fs.writeFileSync(outputPath, html);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Total size: ${(html.length / 1024).toFixed(2)} KB\n`);

    console.log('Build complete!');
    console.log('The file can be used completely offline after saving.');
}

build().catch(console.error);
