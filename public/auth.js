/**
 * Shared auth helpers for WalletPass for Logistics static pages.
 */

/**
 * @param {string} path
 * @param {RequestInit=} options
 */
export async function authApi(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || res.statusText || "Request failed");
  }
  return data;
}

/** @returns {Promise<{ id: string, firstName: string, lastName: string, company: string, locationName: string, email: string, role: string } | null>} */
export async function fetchMe() {
  try {
    const data = await authApi("/api/auth/me");
    return data.account ?? null;
  } catch {
    return null;
  }
}

/**
 * Populate header auth nav: register/login or user + logout.
 * @param {ParentNode=} root
 */
export async function bindAuthHeader(root = document) {
  const nav = root.querySelector("[data-auth-nav]");
  if (!nav) return;

  const account = await fetchMe();
  nav.replaceChildren();

  if (account) {
    const user = document.createElement("span");
    user.className = "auth-user";
    user.textContent = `${account.firstName} · ${account.locationName}`;

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "header-link";
    logout.setAttribute("data-i18n", "nav.logout");
    logout.textContent = "Wyloguj";
    logout.addEventListener("click", async () => {
      try {
        await authApi("/api/auth/logout", { method: "POST", body: "{}" });
      } catch {
        // ignore
      }
      window.location.href = "/";
    });

    nav.append(user, logout);
  } else {
    const register = document.createElement("a");
    register.href = "/zarejestruj";
    register.className = "header-link";
    register.setAttribute("data-i18n", "nav.register");
    register.textContent = "Zarejestruj";

    const login = document.createElement("a");
    login.href = "/zaloguj";
    login.className = "header-link header-link-strong";
    login.setAttribute("data-i18n", "nav.login");
    login.textContent = "Zaloguj";

    nav.append(register, login);
  }
}
