import { $, ago, api, fmt, h, mountAuth, usd } from '/kit/kit.js';

mountAuth({ appHref: '/app/' });

const delta = (pct) => (pct == null ? h('span', { class: 'muted' }, '—') : h('span', { class: `delta ${pct >= 0 ? 'up' : 'down'}` }, `${pct >= 0 ? '▲' : '▼'} ${fmt(Math.abs(pct), 2)}%`));
const skeletonTiles = (el, n) => el.replaceChildren(...Array.from({ length: n }, () => h('div', { class: 'card' }, h('div', { class: 'skeleton sk-sm' }), h('div', { class: 'skeleton sk-lg' }))));
const failed = (el, msg, retry) => el.replaceChildren(h('div', { class: 'card empty-inline' }, h('p', { class: 'kit-err' }, msg), h('button', { class: 'btn btn-sm', onclick: retry, type: 'button' }, 'Retry')));

async function loadLive() {
  const el = $('#ticker');
  if (!el.children.length) skeletonTiles(el, 6);
  try {
    const live = await api('/api/live');
    if (!live.coins.length && !live.fearGreed) {
      el.replaceChildren(h('div', { class: 'card empty-inline' }, h('p', { class: 'muted' }, 'No market data is available right now.')));
      return;
    }
    el.replaceChildren(
      ...live.coins.slice(0, 7).map((c) =>
        h('div', { class: 'card kpi' }, h('div', { class: 'l coin' }, c.image ? h('img', { alt: '', loading: 'lazy', src: c.image }) : null, `${c.name} · ${c.symbol.toUpperCase()}`), h('div', { class: 'v tabular' }, usd(c.price)), h('div', {}, delta(c.change24h))),
      ),
      live.fearGreed ? h('div', { class: 'card kpi' }, h('div', { class: 'l' }, 'Fear & Greed'), h('div', { class: 'v' }, String(live.fearGreed.value)), h('div', { class: 'muted' }, live.fearGreed.label)) : null,
      h('p', { class: 'muted ticker-note' }, live.stale ? `Upstream unavailable; showing data from ${ago(live.fetchedAt)}.` : `Updated ${ago(live.fetchedAt)} · CoinGecko, alternative.me`),
    );
  } catch (e) {
    failed(el, `Market data unavailable: ${e.message}`, loadLive);
  }
}

loadLive();
setInterval(loadLive, 60_000);
