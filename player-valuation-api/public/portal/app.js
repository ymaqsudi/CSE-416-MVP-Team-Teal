// Shared portal helpers. All requests use credentials: "include" so the
// dev_token HttpOnly cookie travels.

async function apiFetch(path, options = {}) {
  const opts = {
    credentials: "include",
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  };
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
    opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error((data && data.message) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function requireAuth() {
  try {
    return await apiFetch("/dev/auth/me");
  } catch (err) {
    if (err.status === 401) {
      window.location.href = "/portal/login.html";
      return null;
    }
    throw err;
  }
}

async function logout() {
  try {
    await apiFetch("/dev/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/portal/login.html";
  }
}

function renderNav(currentEmail) {
  const nav = document.getElementById("nav");
  if (!nav) return;
  if (currentEmail) {
    nav.innerHTML = `
      <a href="/portal/keys.html" class="text-blue-600 hover:underline">Keys</a>
      <a href="/portal/account.html" class="text-blue-600 hover:underline">Account</a>
      <span class="text-gray-500">${escapeHtml(currentEmail)}</span>
      <button id="logoutBtn" class="text-red-600 hover:underline">Log out</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", logout);
  } else {
    nav.innerHTML = `
      <a href="/portal/login.html" class="text-blue-600 hover:underline">Log in</a>
      <a href="/portal/register.html" class="text-blue-600 hover:underline">Register</a>
    `;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideError(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString();
}

window.portal = {
  apiFetch,
  requireAuth,
  logout,
  renderNav,
  escapeHtml,
  showError,
  hideError,
  fmtDate,
};
