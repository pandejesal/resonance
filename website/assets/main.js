const SHOP_TOTAL = 50;

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }
  document.querySelectorAll('.nav-links a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );

  initShop();
});

async function initShop() {
  const status = await loadShopStatus();
  showFounderBanner(status);
  wireBuyButtons(status);
}

async function loadShopStatus() {
  try {
    const res = await fetch('/api/status', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('status unavailable');
    return await res.json();
  } catch {
    // The site is still on GitHub Pages (no functions) — treat as closed.
    return { open: false, spots_left: 0 };
  }
}

function showFounderBanner(status) {
  const banner = document.getElementById('founder-banner');
  if (!banner) return;
  if (status.open) {
    banner.hidden = false;
    const spot = banner.querySelector('[data-spots]');
    if (spot) spot.textContent = `${status.spots_left} of ${status.total || SHOP_TOTAL}`;
  } else {
    banner.hidden = true;
  }
}

function wireBuyButtons(status) {
  document.querySelectorAll('.shop-buy').forEach((btn) => {
    if (!status.open) {
      btn.textContent = 'Available at launch';
      btn.classList.add('disabled');
      btn.setAttribute('aria-disabled', 'true');
      return;
    }
    btn.classList.remove('disabled');
    btn.setAttribute('aria-disabled', 'false');
    btn.addEventListener('click', () => {
      const tier = btn.dataset.tier;
      const price = btn.dataset.price;
      openCheckoutModal(tier, price);
    });
  });
}

function openCheckoutModal(tier, price) {
  const tierName = tier === 'lifetime' ? 'Lifetime' : 'Pro';
  closeCheckoutModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'checkout-modal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button class="modal-close" type="button" aria-label="Close">&times;</button>
      <h2 id="checkout-title" class="modal-title">Buy ${tierName} — $${price}</h2>
      <p class="modal-sub">Your license key is emailed to you instantly after payment.</p>
      <form id="checkout-form" novalidate>
        <label class="field">
          <span>Name</span>
          <input type="text" id="checkout-name" name="name" placeholder="How should we greet you?" required maxlength="80" autocomplete="name">
        </label>
        <label class="field">
          <span>Email</span>
          <input type="email" id="checkout-email" name="email" placeholder="you@example.com" required autocomplete="email">
        </label>
        <label class="field field-check">
          <input type="checkbox" id="checkout-founder" name="founder_public">
          <span>I'm one of the founding 50 — you may list my name in the changelog.</span>
        </label>
        <p class="modal-error" id="checkout-error" hidden></p>
        <button class="btn btn-primary btn-block" type="submit" id="checkout-submit">Continue to payment</button>
        <p class="modal-note">Payment is processed by Dodo Payments. We never see your card details.</p>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.modal-close').addEventListener('click', closeCheckoutModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCheckoutModal();
  });

  const form = overlay.querySelector('#checkout-form');
  const errorEl = overlay.querySelector('#checkout-error');
  const submit = overlay.querySelector('#checkout-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('checkout-name').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const founderPublic = document.getElementById('checkout-founder').checked;
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showError(errorEl, 'Please enter your name and a valid email.');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Opening payment…';
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier, name, email, founder_public: founderPublic }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.url) {
        window.location.href = data.url;
        return;
      }
      const message =
        data && data.error === 'not_open'
          ? 'The shop opens at launch.'
          : 'Something went wrong starting checkout. Please try again.';
      showError(errorEl, message);
      submit.disabled = false;
      submit.textContent = 'Continue to payment';
    } catch {
      showError(errorEl, 'Could not reach the checkout. Please try again.');
      submit.disabled = false;
      submit.textContent = 'Continue to payment';
    }
  });
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.remove();
}
