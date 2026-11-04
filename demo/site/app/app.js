import { $, ago, api, busy, confirmDialog, copy, evm, gate, h, mountAuth, mountKeys, mountUsage, short, switchEvmChain, tabs, toast, user } from '/kit/kit.js';
import { evmKeyAddress, generateEvm, generateSol, signPayment } from '/app/agent.js';

mountAuth({ appHref: '/app/' });

/** Mirrors EVM_CHAINS in src/x402.ts, plus the wallet_addEthereumChain currency. */
const CHAINS = [
  { currency: 'ETH', explorer: 'https://basescan.org', id: 8453, name: 'Base', rpc: 'https://mainnet.base.org', testnet: false },
  { currency: 'ETH', explorer: 'https://sepolia.basescan.org', id: 84532, name: 'Base Sepolia', rpc: 'https://sepolia.base.org', testnet: true },
  { currency: 'POL', explorer: 'https://polygonscan.com', id: 137, name: 'Polygon', rpc: 'https://polygon-rpc.com', testnet: false },
  { currency: 'POL', explorer: 'https://amoy.polygonscan.com', id: 80002, name: 'Polygon Amoy', rpc: 'https://rpc-amoy.polygon.technology', testnet: true },
  { currency: 'AVAX', explorer: 'https://snowtrace.io', id: 43114, name: 'Avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc', testnet: false },
  { currency: 'AVAX', explorer: 'https://testnet.snowtrace.io', id: 43113, name: 'Avalanche Fuji', rpc: 'https://api.avax-test.network/ext/bc/C/rpc', testnet: true },
];
const chainById = (id) => CHAINS.find((c) => c.id === id) ?? null;

const usdc = (v) => (v == null ? '—' : `${v} USDC`);
const skel = (rows = 3) => h('div', { class: 'stack' }, Array.from({ length: rows }, () => h('div', { class: 'skeleton sk-row' })));
const empty = (text) => h('p', { class: 'empty-inline muted' }, text);
const tile = (label, value, extra) => h('div', { class: 'card kpi' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), extra ? h('div', { class: 'muted' }, extra) : null);
const table = (head, rows) => h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, c)))), h('tbody', {}, rows)));
const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
const link = (href, text) => h('a', { href, rel: 'noopener', target: '_blank' }, text);
const statusBadge = (s) => h('span', { class: `badge ${s === 'settled' || s === 'delivered' ? 'ok' : s === 'failed' ? 'bad' : 'warn'}` }, s);
const pretty = (text) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

/** Renders `load()` into `el` with skeleton, error-with-retry and populated states. */
async function section(el, load, render, { quiet = false } = {}) {
  if (!quiet || !el.children.length) el.replaceChildren(skel());
  try {
    el.replaceChildren(...[render(await load())].flat());
  } catch (e) {
    el.replaceChildren(h('div', { class: 'empty-inline' }, h('p', { class: 'kit-err' }, e.message), h('button', { class: 'btn btn-sm', onclick: () => section(el, load, render), type: 'button' }, 'Retry')));
  }
}

const removeButton = (label, text, path, after) =>
  h('button', {
    'aria-label': label,
    class: 'btn btn-sm btn-ghost',
    onclick: async (ev) => {
      if (!(await confirmDialog(text, 'Delete'))) return;
      await busy(ev.currentTarget, async () => {
        await api(path, { method: 'DELETE' });
        toast('Deleted', 'success');
        after();
      });
    },
    type: 'button',
  }, 'Delete');

/* ---------------------------------------------------------------- overview */

function loadOverview() {
  const kpis = $('#kpis');
  const recent = $('#recent');
  kpis.replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'card kpi' }, h('div', { class: 'skeleton sk-sm' }), h('div', { class: 'skeleton sk-lg' }))));
  recent.replaceChildren(skel(2));
  api('/api/overview')
    .then((o) => {
      kpis.replaceChildren(
        tile('Agent wallets', String(o.wallets), h('a', { href: '#wallets' }, 'Manage')),
        tile('Paywalls', `${o.paywallsActive} / ${o.paywalls}`, 'active / total'),
        tile('Earned', usdc(o.earnedUsdc), `${o.paymentsIn} settled payments in`),
        tile('Paid', usdc(o.paidUsdc), `${o.paymentsOut} settled payments out`),
        tile('API calls', String(o.apiCalls30d), 'last 30 days'),
      );
      recent.replaceChildren(
        o.recent.length
          ? table(['When', 'Direction', 'Resource', 'Status'], o.recent.map((p) => h('tr', {}, h('td', { class: 'nowrap' }, ago(p.created_at)), h('td', {}, p.direction === 'in' ? 'Received' : 'Sent'), h('td', { class: 'trunc' }, p.resource), h('td', {}, statusBadge(p.status)))))
          : empty('No payments yet. Payments to your paywalls and from the Pay console show up here.'),
      );
    })
    .catch((e) => {
      const retry = h('button', { class: 'btn btn-sm', onclick: loadOverview, type: 'button' }, 'Retry');
      kpis.replaceChildren(h('div', { class: 'empty-inline' }, h('p', { class: 'kit-err' }, e.message), retry));
      recent.replaceChildren();
    });
}

/* ---------------------------------------------------------------- wallets */

function saveSecret(w) {
  const blob = new Blob([JSON.stringify({ address: w.address, chain: w.chain, secret: w.secret }, null, 2)], { type: 'application/json' });
  const a = h('a', { download: `agenti-${w.chain}-${w.address.slice(0, 8)}.json`, href: URL.createObjectURL(blob) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function generate(chain, btn) {
  const out = $('#gen-out');
  const w = chain === 'evm' ? generateEvm() : generateSol();
  const label = `${chain === 'evm' ? 'evm' : 'sol'}-agent-${new Date().toISOString().slice(0, 10)}`;
  const saved = await busy(btn, () => api('/api/wallets', { body: { address: w.address, chain, label } }));
  if (!saved) return;
  out.hidden = false;
  out.replaceChildren(
    h('div', { class: 'callout warn stack' },
      h('strong', {}, 'Save this secret now. It will not be shown again.'),
      h('div', { class: 'muted' }, `Address: ${w.address}`),
      h('div', { class: 'secret' }, w.secret),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm', onclick: () => copy(w.secret, 'Secret copied'), type: 'button' }, 'Copy secret'),
        h('button', { class: 'btn btn-sm', onclick: () => saveSecret(w), type: 'button' }, 'Download JSON'),
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { out.hidden = true; out.replaceChildren(); }, type: 'button' }, 'I saved it'))),
  );
  toast('Agent wallet created', 'success');
  loadWallets();
}

function balanceBox(w) {
  const box = h('div', { class: 'stack' });
  const load = () =>
    section(box, () => api(`/api/wallets/${w.id}/balances`), (b) => [
      ...b.networks.map((n) =>
        h('div', { class: 'netrow' },
          h('span', {}, n.networkName, n.testnet ? h('span', { class: 'badge warn' }, ' testnet') : null),
          n.error ? h('span', { class: 'kit-err' }, n.error) : h('span', { class: 'tabular' }, `${n.native ?? '0'} ${n.nativeSymbol} · ${n.usdc ?? '0'} USDC`))),
      h('div', { class: 'muted' }, `Updated ${ago(b.fetchedAt)}${b.stale ? ' (cached, upstream slow)' : ''}`),
    ]);
  load();
  return box;
}

function loadWallets() {
  section($('#wallets'), () => api('/api/wallets'), ({ wallets }) =>
    wallets.length
      ? h('div', { class: 'stack' }, wallets.map((w) => {
        const bal = h('div', { hidden: true });
        return h('div', { class: 'card stack' },
          h('div', { class: 'row' },
            h('strong', { class: 'grow' }, w.label, ' ', h('span', { class: 'badge' }, w.chain === 'evm' ? 'EVM' : 'Solana')),
            h('code', { class: 'hash', title: w.address }, short(w.address, 6)),
            h('button', { class: 'btn btn-sm', onclick: () => copy(w.address, 'Address copied'), type: 'button' }, 'Copy'),
            h('button', { class: 'btn btn-sm', onclick: () => { bal.hidden = !bal.hidden; if (!bal.hidden) bal.replaceChildren(balanceBox(w)); }, type: 'button' }, 'Balances'),
            removeButton(`Delete ${w.label}`, `Remove ${w.label} from Agenti Cloud? The on-chain wallet is not affected.`, `/api/wallets/${w.id}`, loadWallets)),
          bal);
      }))
      : empty('No agent wallets yet. Generate one or register an address you already control.'));
}

/* ---------------------------------------------------------------- paywalls */

let paywallNetwork = null;

function loadPaywalls() {
  section($('#paywalls'), () => api('/api/paywalls'), ({ network, paywalls }) => {
    paywallNetwork = network;
    $('#pw-network').textContent = `Callers pay in USDC on ${network.name} (${network.caip}). Settlement goes through the public x402.org facilitator; nothing is custodied here.`;
    $('#my-paywalls').replaceChildren(...(paywalls.length ? ['Try one of yours: ', ...paywalls.slice(0, 3).map((p) => h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { $('#quote-form').url.value = p.url; }, type: 'button' }, p.name))] : []));
    if (!paywalls.length) return empty('No paywalls yet. Put any public HTTPS API behind one with the form above.');
    return h('div', { class: 'stack' }, paywalls.map((p) =>
      h('div', { class: 'card stack' },
        h('div', { class: 'row' },
          h('strong', { class: 'grow' }, p.name, ' ', h('span', { class: `badge ${p.active ? 'ok' : 'warn'}` }, p.active ? 'live' : 'paused')),
          h('span', { class: 'tabular' }, `${p.priceUsdc} USDC / call`)),
        p.description ? h('p', { class: 'muted' }, p.description) : null,
        h('div', { class: 'row' }, h('code', { class: 'grow trunc' }, p.url), h('button', { class: 'btn btn-sm', onclick: () => copy(p.url, 'Paywall URL copied'), type: 'button' }, 'Copy URL')),
        h('div', { class: 'muted trunc' }, `Upstream ${p.upstream} · pays ${short(p.payTo, 6)}`),
        h('div', { class: 'row' },
          h('span', { class: 'grow muted' }, `${p.calls} paid attempts · ${p.settled} settled · ${p.earnedUsdc} USDC earned · created ${ago(p.createdAt)}`),
          h('a', { class: 'btn btn-sm', href: '#pay', onclick: () => { $('#quote-form').url.value = p.url; }, type: 'button' }, 'Test pay'),
          h('button', {
            class: 'btn btn-sm',
            onclick: (ev) => busy(ev.currentTarget, async () => {
              await api(`/api/paywalls/${p.id}`, { body: { active: !p.active }, method: 'PUT' });
              toast(p.active ? 'Paywall paused' : 'Paywall live', 'success');
              loadPaywalls();
            }),
            type: 'button',
          }, p.active ? 'Pause' : 'Resume'),
          removeButton(`Delete ${p.name}`, `Delete the paywall "${p.name}"? Its URL stops working immediately.`, `/api/paywalls/${p.id}`, loadPaywalls)))));
  }, { quiet: true });
}

/* ---------------------------------------------------------------- pay console */

function signerPicker() {
  const keyInput = h('input', { autocomplete: 'off', class: 'input', placeholder: '0x… 64 hex characters', spellcheck: 'false', type: 'password' });
  const derived = h('div', { class: 'muted' });
  keyInput.addEventListener('input', () => {
    const v = keyInput.value.trim();
    if (!v) return (derived.textContent = '');
    try {
      derived.textContent = `Pays from ${evmKeyAddress(v).address}`;
    } catch (e) {
      derived.textContent = e.message;
    }
  });
  const keyBox = h('div', { class: 'stack' }, h('label', { class: 'field' }, 'Agent private key (used in this tab only, never sent or stored)', keyInput), derived);
  const wallet = h('input', { checked: true, name: 'signer', type: 'radio', value: 'wallet' });
  const key = h('input', { name: 'signer', type: 'radio', value: 'key' });
  const sync = () => (keyBox.hidden = !key.checked);
  wallet.addEventListener('change', sync);
  key.addEventListener('change', sync);
  sync();
  return {
    el: h('div', { class: 'stack' },
      h('div', { class: 'grid-2' },
        h('label', { class: 'opt' }, h('span', {}, wallet, h('strong', {}, 'Connected wallet')), h('span', { class: 'muted' }, 'MetaMask, Rabby, Coinbase Wallet… signs an EIP-3009 authorization.')),
        h('label', { class: 'opt' }, h('span', {}, key, h('strong', {}, 'Agent key')), h('span', { class: 'muted' }, 'Paste the secret of an EVM agent wallet you generated.'))),
      keyBox),
    async signer(chainId) {
      if (key.checked) {
        const v = keyInput.value.trim();
        if (!v) throw new Error('Paste the agent private key first');
        return { key: v, kind: 'key' };
      }
      const provider = evm();
      if (!provider) throw new Error('No Ethereum wallet detected in this browser. Use an agent key instead.');
      const c = chainById(chainId);
      await switchEvmChain({ currency: { decimals: 18, name: c.currency, symbol: c.currency }, explorer: c.explorer, id: c.id, name: c.name, rpc: c.rpc });
      return { kind: 'wallet', provider };
    },
  };
}

function renderResult(r) {
  const ok = r.status < 400;
  let settlement = null;
  if (r.settlement) settlement = h('pre', { class: 'code' }, JSON.stringify(r.settlement, null, 2));
  return h('div', { class: `card stack callout ${ok ? 'ok' : 'bad'}` },
    h('div', { class: 'row' },
      h('h3', { class: 'grow' }, ok ? 'Paid and delivered' : 'Payment rejected'),
      h('span', { class: `badge ${ok ? 'ok' : 'bad'}` }, `HTTP ${r.status}`),
      h('span', { class: 'muted' }, `${r.ms} ms`)),
    r.error ? h('p', { class: 'kit-err' }, r.error) : null,
    r.explorerTx ? h('p', {}, 'Settlement transaction: ', link(r.explorerTx, short(r.explorerTx.split('/').pop(), 8))) : null,
    settlement,
    h('div', { class: 'muted' }, `Response body (${r.contentType || 'unknown type'})${r.clipped ? ', clipped to 20 KB' : ''}`),
    h('pre', { class: 'code result-body' }, pretty(r.body) || '(empty body)'));
}

function renderQuote(q, req) {
  const out = $('#quote-out');
  if (!q.quote) {
    out.replaceChildren(h('div', { class: 'card stack' },
      h('div', { class: 'row' }, h('h3', { class: 'grow' }, q.status === 402 ? 'Payment required, but not in x402 format' : 'No payment required'), h('span', { class: 'badge' }, `HTTP ${q.status}`)),
      h('p', { class: 'muted' }, q.status === 402 ? 'The server answered 402 without a PAYMENT-REQUIRED header or an x402 accepts list.' : 'This URL answered without asking for payment. Its response preview:'),
      h('pre', { class: 'code result-body' }, pretty(q.preview ?? '') || '(empty body)')));
    return;
  }
  const { options, resource, version } = q.quote;
  const picks = options.map((o, i) => {
    const input = h('input', { checked: !o.unsupported && options.findIndex((x) => !x.unsupported) === i, disabled: !!o.unsupported, name: 'option', type: 'radio', value: String(i) });
    const c = o.chainId ? chainById(o.chainId) : null;
    const amount = /^\d+$/.test(o.amount) ? (Number(o.amount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 }) : o.amount;
    return {
      el: h('label', { class: `opt${o.unsupported ? ' disabled' : ''}` },
        h('span', {}, input, h('strong', {}, `${amount} ${o.extra?.name ?? 'token'}`), ` on ${o.networkName}`, c && !c.testnet ? h('span', { class: 'badge bad' }, ' mainnet') : c ? h('span', { class: 'badge ok' }, ' testnet') : null),
        h('span', { class: 'muted trunc' }, `${o.scheme} · pay to ${short(o.payTo, 6)} · asset ${short(o.asset, 6)}`),
        o.unsupported ? h('span', { class: 'kit-err' }, o.unsupported) : null),
      input,
      option: o,
    };
  });
  const picker = signerPicker();
  const result = h('div');
  const mainnetWarn = h('div', { class: 'callout bad', hidden: true }, 'This option spends real funds on a mainnet. Double-check the amount and recipient before signing.');
  const syncWarn = () => {
    const sel = picks.find((p) => p.input.checked)?.option;
    mainnetWarn.hidden = !(sel?.chainId && !chainById(sel.chainId)?.testnet);
  };
  for (const p of picks) p.input.addEventListener('change', syncWarn);
  syncWarn();
  const payBtn = h('button', { class: 'btn btn-primary', disabled: !picks.some((p) => !p.option.unsupported), type: 'button' }, 'Sign and pay');
  payBtn.addEventListener('click', () =>
    busy(payBtn, async () => {
      const sel = picks.find((p) => p.input.checked)?.option;
      if (!sel) throw new Error('Choose a payment option');
      const signer = await picker.signer(sel.chainId);
      const signed = await signPayment(signer, sel, resource ?? { description: '', mimeType: '', url: req.url }, version);
      result.replaceChildren(skel(2));
      try {
        const r = await api('/api/pay/submit', { body: { ...req, header: signed.header, value: signed.value } });
        result.replaceChildren(renderResult(r));
        toast(r.status < 400 ? 'Payment accepted' : `Server answered ${r.status}`, r.status < 400 ? 'success' : 'error');
      } catch (e) {
        result.replaceChildren(h('p', { class: 'kit-err' }, e.message));
        throw e;
      }
    }));
  out.replaceChildren(
    h('div', { class: 'card stack' },
      h('div', { class: 'row' }, h('h3', { class: 'grow' }, '2. Choose how to pay'), h('span', { class: 'badge warn' }, `HTTP 402 · x402 v${version}`)),
      resource?.description ? h('p', { class: 'muted' }, resource.description) : null,
      q.quote.error ? h('p', { class: 'muted' }, `Server message: ${q.quote.error}`) : null,
      options.length ? h('div', { class: 'stack' }, picks.map((p) => p.el)) : empty('The server listed no payment options.'),
      mainnetWarn,
      h('p', { class: 'muted' }, 'Testnet USDC for Base Sepolia is free from the ', link('https://faucet.circle.com', 'Circle faucet'), '. No gas is needed: the facilitator submits the transfer.')),
    h('div', { class: 'card stack' }, h('h3', {}, '3. Sign'), picker.el, h('div', { class: 'row end' }, payBtn)),
    result,
  );
}

function initPay() {
  const form = $('#quote-form');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const d = formData(form);
    const req = { method: d.method, url: d.url, ...(d.body ? { body: d.body } : {}) };
    if (d.body) {
      try {
        JSON.parse(d.body);
      } catch {
        return toast('The body must be valid JSON', 'error');
      }
    }
    const out = $('#quote-out');
    out.replaceChildren(skel(3));
    busy(btn, async () => {
      try {
        renderQuote(await api('/api/pay/quote', { body: req }), req);
      } catch (e) {
        out.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'kit-err' }, e.message)));
        throw e;
      }
    });
  });
}

/* ---------------------------------------------------------------- payments */

function loadPayments() {
  const dir = $('#pay-dir').value;
  section($('#payments'), () => api(`/api/payments${dir ? `?direction=${dir}` : ''}`), ({ payments }) =>
    payments.length
      ? table(['When', 'Direction', 'Resource', 'Amount', 'From → to', 'Status', 'Tx'], payments.map((p) =>
        h('tr', {},
          h('td', { class: 'nowrap' }, ago(p.created_at)),
          h('td', {}, p.direction === 'in' ? 'Received' : 'Sent'),
          h('td', { class: 'trunc', title: p.resource }, p.resource),
          h('td', { class: 'nowrap tabular' }, usdc(p.amountUsdc)),
          h('td', { class: 'nowrap hash' }, `${short(p.payer ?? '', 4) || '—'} → ${short(p.pay_to ?? '', 4) || '—'}`),
          h('td', { title: p.error ?? '' }, statusBadge(p.status)),
          h('td', {}, p.explorerTx ? link(p.explorerTx, short(p.tx, 4)) : '—'))))
      : empty(dir === 'in' ? 'Nobody has paid your paywalls yet.' : dir === 'out' ? 'You have not paid for anything yet. Try the Pay console.' : 'No payments yet.'));
}

/* ---------------------------------------------------------------- market tools */

let tools = [];

function field(name, schema, required) {
  const label = `${name}${required ? ' *' : ''}`;
  const hint = schema.description ? h('small', { class: 'muted' }, schema.description) : null;
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  let input;
  if (schema.enum) {
    input = h('select', { class: 'input', name }, required ? null : h('option', { value: '' }, '(default)'), schema.enum.map((v) => h('option', { selected: schema.default === v, value: String(v) }, String(v))));
  } else if (type === 'boolean') {
    input = h('select', { class: 'input', name }, h('option', { value: '' }, '(default)'), h('option', { value: 'true' }, 'true'), h('option', { value: 'false' }, 'false'));
  } else {
    input = h('input', {
      class: 'input',
      name,
      placeholder: schema.default != null ? String(schema.default) : type === 'array' ? 'comma,separated' : '',
      required: required || null,
      step: type === 'number' ? 'any' : null,
      type: type === 'number' || type === 'integer' ? 'number' : 'text',
    });
  }
  input.dataset.type = type ?? 'string';
  return h('label', { class: 'field' }, label, input, hint);
}

function collect(form) {
  const args = {};
  for (const el of form.querySelectorAll('[name]')) {
    const v = el.value.trim();
    if (!v) continue;
    const t = el.dataset.type;
    args[el.name] = t === 'number' || t === 'integer' ? Number(v) : t === 'boolean' ? v === 'true' : t === 'array' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v;
  }
  return args;
}

function openTool(t, btn) {
  for (const b of document.querySelectorAll('.tool-item')) b.setAttribute('aria-current', String(b === btn));
  const props = t.inputSchema.properties ?? {};
  const req = new Set(t.inputSchema.required ?? []);
  const out = h('div');
  const form = h('form', { class: 'stack' }, Object.entries(props).map(([k, s]) => field(k, s, req.has(k))), h('div', { class: 'row end' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Run')));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    out.replaceChildren(skel(3));
    busy(form.querySelector('[type=submit]'), async () => {
      try {
        const r = await api(`/api/market/run/${encodeURIComponent(t.name)}`, { body: collect(form) });
        out.replaceChildren(h('div', { class: 'muted' }, `${r.ms} ms`), h('pre', { class: 'code result-body' }, JSON.stringify(r.result, null, 2)));
      } catch (e) {
        out.replaceChildren(h('p', { class: 'kit-err' }, e.message));
        throw e;
      }
    });
  });
  $('#tool-pane').replaceChildren(
    h('div', { class: 'row' }, h('h3', { class: 'grow' }, t.title), h('span', { class: 'badge' }, t.group)),
    h('p', { class: 'muted' }, t.description),
    h('code', { class: 'muted' }, `POST /api/market/run/${t.name}`),
    Object.keys(props).length ? null : h('p', { class: 'muted' }, 'This tool takes no arguments.'),
    form,
    out,
  );
}

function renderTools() {
  const q = $('#tool-filter').value.trim().toLowerCase();
  const list = $('#tool-list');
  const shown = tools.filter((t) => !q || `${t.name} ${t.title} ${t.description} ${t.group}`.toLowerCase().includes(q));
  if (!shown.length) return list.replaceChildren(empty(q ? `No tool matches "${q}".` : 'No tools available.'));
  const groups = [...new Set(shown.map((t) => t.group))];
  list.replaceChildren(...groups.flatMap((g) => [
    h('div', { class: 'muted' }, h('strong', {}, g)),
    ...shown.filter((t) => t.group === g).map((t) => {
      const b = h('button', { class: 'tool-item', type: 'button' }, t.title, h('small', {}, t.name));
      b.addEventListener('click', () => openTool(t, b));
      return b;
    }),
  ]));
}

function loadTools() {
  section($('#tool-list'), () => api('/api/market/tools'), (r) => {
    tools = r.tools;
    queueMicrotask(renderTools);
    return skel(1);
  });
}

/* ---------------------------------------------------------------- mcp */

function initMcp() {
  const url = `${location.origin}/mcp`;
  $('#mcp-url').textContent = url;
  $('#mcp-copy').addEventListener('click', () => copy(url, 'MCP URL copied'));
  $('#mcp-config').textContent = JSON.stringify({ mcpServers: { agenti: { headers: { Authorization: 'Bearer <your API key>' }, type: 'http', url } } }, null, 2);
  $('#mcp-curl').textContent = `curl -s ${url} \\\n  -H "Authorization: Bearer $AGENTI_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  section($('#mcp-tools'), () => api('/mcp', { body: { id: 1, jsonrpc: '2.0', method: 'tools/list' } }), (r) => {
    const list = r.result?.tools ?? [];
    if (!list.length) return empty('The MCP server listed no tools.');
    return [h('p', { class: 'muted' }, `${list.length} tools`), table(['Name', 'Description'], list.map((t) => h('tr', {}, h('td', { class: 'nowrap' }, h('code', {}, t.name)), h('td', {}, t.description))))];
  });
}

/* ---------------------------------------------------------------- boot */

const root = $('#app');
await gate(root, { text: 'Connect an Ethereum or Solana wallet to manage agent wallets, paywalls and payments.', title: 'Sign in to Agenti Cloud' });
const u = user();
$('#who').textContent = `${u.chain === 'evm' ? 'EVM' : 'Solana'} · ${short(u.address, 6)}`;
if (u.chain !== 'evm') $('#paywall-form').payTo.required = true;
tabs(root);

$('#gen-evm').addEventListener('click', (ev) => generate('evm', ev.currentTarget));
$('#gen-sol').addEventListener('click', (ev) => generate('sol', ev.currentTarget));
$('#wallets-reload').addEventListener('click', loadWallets);
$('#wallet-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  busy(form.querySelector('[type=submit]'), async () => {
    await api('/api/wallets', { body: formData(form) });
    form.reset();
    toast('Wallet added', 'success');
    loadWallets();
  });
});

$('#paywalls-reload').addEventListener('click', loadPaywalls);
$('#paywall-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  busy(form.querySelector('[type=submit]'), async () => {
    const d = formData(form);
    if (!d.payTo) delete d.payTo;
    const { paywall } = await api('/api/paywalls', { body: d });
    form.reset();
    toast(`Paywall live on ${paywallNetwork?.name ?? 'Base Sepolia'}`, 'success');
    copy(paywall.url, 'Paywall URL copied');
    loadPaywalls();
    loadOverview();
  });
});

$('#pay-dir').addEventListener('change', loadPayments);
$('#tool-filter').addEventListener('input', renderTools);

initPay();
initMcp();
loadOverview();
loadWallets();
loadPaywalls();
loadPayments();
loadTools();
mountKeys($('#keys'), { endpointHint: `curl -s ${location.origin}/api/market/run/get_coin_prices -H "Authorization: Bearer $KEY" -H "content-type: application/json" -d '{"coins":"bitcoin,ethereum"}'` });
const usage = mountUsage($('#usage'));
window.addEventListener('hashchange', () => {
  const tab = location.hash.slice(1);
  if (tab === 'usage') usage.reload();
  if (tab === 'overview') loadOverview();
  if (tab === 'payments') loadPayments();
});
