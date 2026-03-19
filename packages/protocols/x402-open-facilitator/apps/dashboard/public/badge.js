(function() {
  const API_BASE = 'https://api.openfacilitator.io';
  const BADGE_BASE = 'https://openfacilitator.io';

  function createBadge(facilitator, supportsRefunds, size, theme) {
    if (!supportsRefunds) return null;

    const link = document.createElement('a');
    link.href = `${BADGE_BASE}/verify?facilitator=${facilitator}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'openfacilitator-badge';
    link.style.display = 'inline-block';

    const img = document.createElement('img');
    const variant = theme === 'dark' ? '-dark' : '';
    const sizeVariant = size === 'small' ? '-sm' : size === 'large' ? '-lg' : '';
    img.src = `${BADGE_BASE}/badges/refund-protected${variant}${sizeVariant}.svg`;
    img.alt = 'Refund Protected by OpenFacilitator';
    img.style.display = 'block';

    link.appendChild(img);
    return link;
  }

  async function verify(facilitator) {
    try {
      const res = await fetch(`${API_BASE}/api/verify?facilitator=${encodeURIComponent(facilitator)}`);
      return await res.json();
    } catch (e) {
      console.error('[OpenFacilitator] Verification failed:', e);
      return { verified: false, supportsRefunds: false };
    }
  }

  async function init() {
    // Find all elements with data-openfacilitator-badge
    const elements = document.querySelectorAll('[data-openfacilitator-badge]');

    // Also check for script tag with data-facilitator
    const script = document.currentScript || document.querySelector('script[data-facilitator]');

    if (script && script.dataset.facilitator) {
      const facilitator = script.dataset.facilitator;
      const size = script.dataset.size || 'medium';
      const theme = script.dataset.theme || 'light';

      const result = await verify(facilitator);
      if (result.supportsRefunds) {
        const badge = createBadge(facilitator, true, size, theme);
        if (badge) script.parentNode.insertBefore(badge, script.nextSibling);
      }
    }

    // Process elements with data attribute
    for (const el of elements) {
      const facilitator = el.dataset.openfacilitatorBadge || el.dataset.facilitator;
      if (!facilitator) continue;

      const size = el.dataset.size || 'medium';
      const theme = el.dataset.theme || 'light';

      const result = await verify(facilitator);
      if (result.supportsRefunds) {
        const badge = createBadge(facilitator, true, size, theme);
        if (badge) el.appendChild(badge);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
