/* ============================================================
   Login + registration forms (client validation mirrors the API)
   ============================================================ */

(() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setFieldError(input, errorNode, message) {
    if (input) input.classList.toggle('invalid', Boolean(message));
    if (errorNode) errorNode.textContent = message || '';
  }

  function setupPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.target || '');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        button.setAttribute('aria-pressed', show ? 'true' : 'false');
      });
    });
  }

  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const email = document.getElementById('login-email');
    const password = document.getElementById('login-password');
    const emailError = document.getElementById('login-email-error');
    const passwordError = document.getElementById('login-password-error');
    const errorBox = document.getElementById('auth-error');
    const submit = document.getElementById('login-submit');

    // If the user came from registration, prefill and show a success note.
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1') {
      App.showNotice(errorBox, 'Account created. You can log in now.', 'success');
    }
    try {
      const saved = sessionStorage.getItem('tbai:lastEmail');
      if (saved && email) email.value = saved;
    } catch (storageError) {
      /* sessionStorage may be disabled — not critical */
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFieldError(email, emailError, '');
      setFieldError(password, passwordError, '');
      App.hideNotice(errorBox);

      let valid = true;
      if (!EMAIL_RE.test(email.value.trim())) {
        setFieldError(email, emailError, 'Enter a valid email address.');
        valid = false;
      }
      if (!password.value) {
        setFieldError(password, passwordError, 'Enter your password.');
        valid = false;
      }
      if (!valid) return;

      App.setButtonLoading(submit, true, 'Signing in…');
      try {
        const data = await App.api('login.php', {
          method: 'POST',
          body: {
            email: email.value.trim(),
            password: password.value,
          },
        });
        App.state.user = data.user;
        App.state.csrf = data.csrf_token;
        try {
          sessionStorage.removeItem('tbai:lastEmail');
        } catch (storageError) {
          /* ignore */
        }
        const next = App.readSafeNext();
        window.location.href = next || 'dashboard.html';
      } catch (error) {
        const msg = error.status === 429
          ? 'Too many login attempts. You are temporarily locked out. Please wait 15 minutes and try again.'
          : error.message;
        App.showNotice(errorBox, msg, 'error');
        App.setButtonLoading(submit, false);
      }
    });
  }

  function initRegister() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const name = document.getElementById('register-name');
    const email = document.getElementById('register-email');
    const password = document.getElementById('register-password');
    const confirm = document.getElementById('register-confirm');
    const nameError = document.getElementById('register-name-error');
    const emailError = document.getElementById('register-email-error');
    const passwordError = document.getElementById('register-password-error');
    const confirmError = document.getElementById('register-confirm-error');
    const errorBox = document.getElementById('auth-error');
    const submit = document.getElementById('register-submit');

    // Live confirmation feedback once the user starts typing.
    confirm.addEventListener('input', () => {
      if (!confirm.value) {
        setFieldError(confirm, confirmError, '');
      } else if (confirm.value !== password.value) {
        setFieldError(confirm, confirmError, 'Passwords do not match yet.');
      } else {
        setFieldError(confirm, confirmError, '');
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      App.hideNotice(errorBox);
      [nameError, emailError, passwordError, confirmError].forEach((node) => {
        if (node) node.textContent = '';
      });
      [name, email, password, confirm].forEach((input) => input.classList.remove('invalid'));

      let valid = true;
      const trimmedName = name.value.trim();
      if (trimmedName.length < 1 || trimmedName.length > 100) {
        setFieldError(name, nameError, 'Name must be between 1 and 100 characters.');
        valid = false;
      }
      if (!EMAIL_RE.test(email.value.trim()) || email.value.trim().length > 190) {
        setFieldError(email, emailError, 'Enter a valid email address (max 190 characters).');
        valid = false;
      }
      if (password.value.length < 8 || password.value.length > 72) {
        setFieldError(password, passwordError, 'Password must be between 8 and 72 characters.');
        valid = false;
      }
      if (confirm.value !== password.value || !confirm.value) {
        setFieldError(confirm, confirmError, 'The passwords do not match.');
        valid = false;
      }
      if (!valid) return;

      App.setButtonLoading(submit, true, 'Creating account…');
      try {
        await App.api('register.php', {
          method: 'POST',
          body: {
            name: name.value.trim(),
            email: email.value.trim(),
            password: password.value,
            confirm_password: confirm.value,
          },
        });
        try {
          sessionStorage.setItem('tbai:lastEmail', email.value.trim());
        } catch (storageError) {
          /* ignore */
        }
        App.showNotice(errorBox, 'Account created. Taking you to the login page…', 'success');
        form.querySelectorAll('input, button').forEach((node) => {
          node.disabled = true;
        });
        window.setTimeout(() => {
          window.location.href = 'login.html?registered=1';
        }, 1300);
      } catch (error) {
        const msg = error.status === 429
          ? 'Too many login attempts. You are temporarily locked out. Please wait 15 minutes and try again.'
          : error.message;
        App.showNotice(errorBox, msg, 'error');
        App.setButtonLoading(submit, false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    setupPasswordToggles();
    await App.init({ checkGuest: true });
    initLogin();
    initRegister();
  });
})();
