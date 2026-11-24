/* ============================================================
   Teach-Back AI — shared front-end utilities
   - fetch wrapper with CSRF header + consistent errors
   - auth guard (calls api/me.php on protected pages)
   - nav / modal / toast / DOM helpers
   Everything user- or AI-generated is inserted with textContent.
   ============================================================ */

class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data || null;
  }
}

const App = (() => {
  const API_BASE = 'api/';
  const state = {
    user: null,
    csrf: null,
  };

  /* ---------- Tiny DOM helpers ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Constant icon paths (never used with user data) ---------- */
  const ICONS = {
    check: 'M20 6 9 17l-5-5',
    alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
    send: 'm22 2-7 20-4-9-9-4ZM22 2 11 13',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    rotate: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
    chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0ZM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3',
    book: 'M12 7v14M3 5h6a3 3 0 0 1 3 3M21 5h-6a3 3 0 0 0-3 3M3 5v14h6a3 3 0 0 1 3 3M21 5v14h-6a3 3 0 0 0-3 3',
    x: 'M18 6 6 18M6 6l12 12',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z',
    lock: 'M5 11h14v10H5ZM8 11V7a4 4 0 0 1 8 0v4',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    user: 'M20 21a8 8 0 0 0-16 0M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 3',
    target: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
    spark: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M9 13h6M9 17h6',
  };

  function icon(name, size = 18) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    const parts = String(ICONS[name] || ICONS.spark).split('M').filter(Boolean);
    parts.forEach((part, index) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', index === 0 && !String(ICONS[name] || '').startsWith('M') ? part : 'M' + part);
      svg.appendChild(path);
    });
    return svg;
  }

  /* ---------- Session / fetch ---------- */
  async function ensureCsrf() {
    if (state.csrf) return state.csrf;
    try {
      const res = await fetch(API_BASE + 'csrf.php');
      const payload = await res.json();
      if (payload && payload.success && payload.data && payload.data.csrf_token) {
        state.csrf = payload.data.csrf_token;
        return state.csrf;
      }
    } catch (e) {
      /* Fallback to me.php */
    }
    try {
      await loadSession({ allow401: true });
    } catch (error) {
      /* A 401 still returns the token header, which api() captures. */
    }
    return state.csrf;
  }

  async function api(path, options = {}) {
    const method = options.method || 'GET';

    // Make sure a POST always has a CSRF token, including on the login and
    // registration pages where the visitor does not have a session user yet.
    if (method !== 'GET') await ensureCsrf();

    const headers = { Accept: 'application/json' };
    const init = { method, headers, credentials: 'same-origin' };

    if (options.body !== undefined && options.body !== null) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    if (method !== 'GET' && state.csrf) {
      headers['X-CSRF-Token'] = state.csrf;
    }

    let response;
    try {
      response = await fetch(API_BASE + path, init);
    } catch (networkError) {
      throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
    }

    // me.php sends the token as a header, so even a 401 can bootstrap the
    // login/register forms with a valid CSRF token.
    const responseToken = response.headers.get('X-CSRF-Token');
    if (responseToken) state.csrf = responseToken;

    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (parseError) {
      payload = null;
    }

    if (!payload || typeof payload !== 'object' || payload.success !== true) {
      const message = (payload && typeof payload.error === 'string' && payload.error)
        ? payload.error
        : 'The server returned an unexpected response. Please check the PHP error log.';
      const error = new ApiError(message, response.status, payload ? payload.data : null);
      if (response.status === 401 && !options.allow401) {
        redirectToLogin();
      }
      throw error;
    }

    return payload.data;
  }

  function redirectToLogin() {
    if (document.body.dataset.authPage === '1') return;
    const file = window.location.pathname.split('/').pop() || 'index.html';
    if (file === 'login.html' || file === 'register.html') return;
    const next = file + window.location.search;
    const safe = /^(dashboard|teach|history)\.html(\?.*)?$/.test(next);
    window.location.href = safe
      ? 'login.html?next=' + encodeURIComponent(next)
      : 'login.html';
  }

  function applyUserToNav() {
    if (!state.user) return;
    document.querySelectorAll('[data-user-name]').forEach((node) => {
      node.textContent = state.user.name;
    });
    document.querySelectorAll('[data-user-initial]').forEach((node) => {
      node.textContent = (state.user.name || '?').trim().charAt(0).toUpperCase();
    });

    // If on a public page (e.g. index.html) with login/register links, show Dashboard button
    const navActions = document.querySelector('.site-header .nav-actions');
    if (navActions && !navActions.querySelector('.user-chip')) {
      const loginLink = navActions.querySelector('a[href*="login.html"]');
      const registerLink = navActions.querySelector('a[href*="register.html"]');
      if (loginLink || registerLink) {
        clear(navActions);
        const dashBtn = el('a', 'btn btn-primary btn-sm', 'Dashboard');
        dashBtn.href = 'dashboard.html';
        navActions.appendChild(dashBtn);
      }
    }
  }

  async function loadSession(options = {}) {
    const allow401 = options.allow401 === true;
    const data = await api('me.php', { allow401 });
    state.user = data.user;
    state.csrf = data.csrf_token;
    applyUserToNav();
    return data;
  }

  /* ---------- Navigation, footer, modals ---------- */
  function setupNav() {
    const header = document.querySelector('.site-header');
    if (header) {
      const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      links.addEventListener('click', (event) => {
        if (event.target.closest('a')) {
          links.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    document.querySelectorAll('[data-logout]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        try {
          await api('logout.php', { method: 'POST', body: {} });
          window.location.href = 'index.html';
        } catch (error) {
          button.disabled = false;
          toast(error.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-year]').forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });

    setupModalBehaviour();
  }

  function setupModalBehaviour() {
    if (document.body.dataset.modalsReady === '1') return;
    document.body.dataset.modalsReady = '1';

    document.addEventListener('click', (event) => {
      const backdrop = event.target.closest('.modal-backdrop');
      if (!backdrop || backdrop.hidden) return;
      if (event.target.closest('[data-close-modal]')) {
        closeModal(backdrop);
        return;
      }
      if (event.target === backdrop && backdrop.dataset.static !== '1') {
        closeModal(backdrop);
      }
    });

    document.addEventListener('keydown', (event) => {
      const open = Array.from(document.querySelectorAll('.modal-backdrop'))
        .filter((modal) => !modal.hidden)
        .pop();

      if (event.key === 'Escape') {
        if (open && open.dataset.static !== '1') closeModal(open);
        return;
      }

      // Keep Tab / Shift+Tab inside the open dialog.
      if (event.key !== 'Tab' || !open) return;
      const focusable = Array.from(open.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => el.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!open.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function openModal(backdrop) {
    if (!backdrop) return;
    backdrop._lastFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add('no-scroll');
    const focusTarget = backdrop.querySelector('[data-close-modal], button, a, input, textarea, select');
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 60);
  }

  function closeModal(backdrop) {
    if (!backdrop) return;
    backdrop.hidden = true;
    if (!document.querySelector('.modal-backdrop:not([hidden])')) {
      document.body.classList.remove('no-scroll');
    }
    if (backdrop._lastFocus && typeof backdrop._lastFocus.focus === 'function') {
      backdrop._lastFocus.focus();
    }
  }

  /* ---------- Toasts & notices ---------- */
  function toast(message, type = 'info', timeout = 5200) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = el('div', 'toast-stack');
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }

    const box = el('div', 'toast toast-' + type);
    const iconName = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'spark';
    box.appendChild(icon(iconName, 17));
    box.appendChild(el('span', '', message));
    stack.appendChild(box);

    window.setTimeout(() => {
      box.style.opacity = '0';
      box.style.transform = 'translateY(6px)';
      box.style.transition = 'opacity .2s ease, transform .2s ease';
      window.setTimeout(() => box.remove(), 220);
    }, timeout);
  }

  function showNotice(container, message, type = 'error') {
    if (!container) return;
    clear(container);
    container.classList.remove('notice-error', 'notice-success', 'notice-info');
    container.classList.add('notice', 'notice-' + type);
    container.hidden = false;
    container.appendChild(icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'spark', 18));
    container.appendChild(el('span', '', message));
  }

  function hideNotice(container) {
    if (!container) return;
    container.hidden = true;
    clear(container);
  }

  function emptyState({ title, text, actionLabel, onAction, iconName = 'inbox' }) {
    const wrap = el('div', 'empty-state');
    const iconBox = el('div', 'empty-icon');
    iconBox.appendChild(icon(iconName, 22));
    wrap.appendChild(iconBox);
    wrap.appendChild(el('p', 'empty-title', title || 'Nothing here yet'));
    if (text) wrap.appendChild(el('p', 'empty-text', text));
    if (actionLabel && typeof onAction === 'function') {
      const button = el('button', 'btn btn-outline btn-sm', actionLabel);
      button.type = 'button';
      button.addEventListener('click', onAction);
      wrap.appendChild(button);
    }
    return wrap;
  }

  /* ---------- Formatting ---------- */
  function formatDate(value, withTime = false) {
    if (!value) return '—';
    const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    if (withTime) {
      options.hour = 'numeric';
      options.minute = '2-digit';
    }
    return date.toLocaleDateString(undefined, options);
  }

  function formatTime(value) {
    if (!value) return '';
    const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function scoreClass(score) {
    if (score === null || score === undefined || Number.isNaN(Number(score))) return 'score-none';
    const value = Number(score);
    if (value >= 7) return 'score-high';
    if (value >= 5) return 'score-mid';
    return 'score-low';
  }

  function verdict(score) {
    if (score === null || score === undefined) return { label: 'Not scored', className: 'verdict-mid' };
    const value = Number(score);
    if (value >= 8) return { label: 'Excellent teaching', className: 'verdict-high' };
    if (value >= 7) return { label: 'Strong explanation', className: 'verdict-high' };
    if (value >= 5) return { label: 'Getting there', className: 'verdict-mid' };
    if (value >= 3) return { label: 'Needs another pass', className: 'verdict-low' };
    return { label: 'Rebuild the basics', className: 'verdict-low' };
  }

  function scoreText(score) {
    if (score === null || score === undefined || score === '') return '—';
    return Number(score).toFixed(1);
  }

  function personaLabel(persona) {
    return {
      beginner: 'Beginner',
      kid: 'Curious Kid',
      skeptic: 'Skeptic',
      professor: 'Professor',
    }[persona] || persona || 'Student';
  }

  function personaIcon(persona) {
    return {
      beginner: 'book',
      kid: 'spark',
      skeptic: 'target',
      professor: 'trophy',
    }[persona] || 'user';
  }

  function setButtonLoading(button, loading, label = 'Working…') {
    if (!button) return;
    if (loading) {
      if (!button._originalNodes) {
        button._originalNodes = Array.from(button.childNodes).map((node) => node.cloneNode(true));
      }
      button.replaceChildren(
        (() => {
          const spinner = el('span', 'spinner');
          return spinner;
        })(),
        document.createTextNode(' ' + label)
      );
      button.disabled = true;
      button.classList.add('is-loading');
    } else {
      if (button._originalNodes) {
        button.replaceChildren(...button._originalNodes.map((node) => node.cloneNode(true)));
        button._originalNodes = null;
      }
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  }

  function statusBadge(status) {
    const badge = el('span', 'badge ' + (status === 'completed' ? 'badge-completed' : 'badge-active'));
    badge.textContent = status === 'completed' ? 'Completed' : 'Active';
    return badge;
  }

  function scoreBadge(score) {
    const badge = el('span', 'badge ' + (score === null ? '' : scoreClass(score)));
    badge.textContent = score === null || score === undefined ? 'Not scored' : scoreText(score) + '/10';
    return badge;
  }

  /* ---------- Page bootstrap ---------- */
  async function init(options = {}) {
    setupNav();

    const requireAuth = options.requireAuth === true;
    const checkGuest = options.checkGuest === true;

    if (requireAuth) {
      try {
        await loadSession();
      } catch (error) {
        if (error.status === 401) {
          redirectToLogin();
          return null;
        }
        toast(error.message, 'error');
        return null;
      }
    }

    if (checkGuest) {
      try {
        const data = await loadSession({ allow401: true });
        if (data && data.user) {
          const next = readSafeNext();
          window.location.href = next || 'dashboard.html';
          return null;
        }
      } catch (error) {
        if (error.status !== 401) {
          toast(error.message, 'error');
        }
      }
    }

    // Public pages (like index.html): softly load session to update navigation if logged in
    if (!requireAuth && !checkGuest) {
      try {
        await loadSession({ allow401: true });
      } catch (e) {
        /* guest visitor, expected */
      }
    }

    return state.user;
  }

  function readSafeNext() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '';
    return /^(dashboard|teach|history)\.html(\?[^#]*)?$/.test(next) ? next : '';
  }

  function handleError(error, container) {
    const message = error && error.message
      ? error.message
      : 'Something went wrong. Please try again.';
    if (container) showNotice(container, message, 'error');
    else toast(message, 'error');
  }

  return {
    api,
    init,
    loadSession,
    openModal,
    closeModal,
    toast,
    showNotice,
    hideNotice,
    emptyState,
    el,
    clear,
    byId,
    icon,
    escapeHtml,
    formatDate,
    formatTime,
    scoreClass,
    scoreText,
    verdict,
    personaLabel,
    personaIcon,
    setButtonLoading,
    statusBadge,
    scoreBadge,
    handleError,
    redirectToLogin,
    readSafeNext,
    state,
  };
})();

/* Pages that only need the shared shell can opt in with data-auto-init="1". */
document.addEventListener('DOMContentLoaded', () => {
  if (document.body && document.body.dataset.autoInit === '1') {
    App.init();
  }
});
