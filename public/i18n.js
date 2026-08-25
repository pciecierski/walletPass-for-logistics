const STORAGE_KEY = "walletpass-for-logistics.lang";

/** @typedef {"pl" | "en"} Locale */

const messages = {
  en: {
    "meta.title": "WalletPass for Logistics — Wallet Pass Studio",
    "nav.create": "Create",
    "nav.passes": "Passes",
    "nav.setup": "Setup",
    "nav.register": "Register",
    "nav.login": "Log in",
    "nav.logout": "Log out",
    "lang.label": "Language",
    "hero.brand": "WalletPass for Logistics try it…",
    "hero.title": "Access passes for logistics parks and secure sites.",
    "hero.lede":
      "Create test passes for a logistics park or other restricted-access sites — we’ll send them to the intended recipient.",
    "hero.ctaCreate": "Create a Google Wallet pass",
    "hero.ctaStatus": "Wallet status",
    "hero.availability":
      "Currently available: <strong>Google Wallet</strong>. Apple Wallet configuration is unavailable for now and will be activated soon.",
    "create.title": "Create",
    "create.lede":
      "Create and publish a test Google Wallet pass. Optionally send an SMS link straight to the recipient. Apple Wallet is not available yet. When you’ve tested enough and are ready to see more, create a user account.",
    "form.organization": "Organization",
    "form.organizationPh": "Harbor Market",
    "form.description": "Description",
    "form.descriptionPh": "Loyalty membership card",
    "form.style": "Pass style",
    "form.style.generic": "Generic",
    "form.style.coupon": "Coupon",
    "form.style.eventTicket": "Event ticket",
    "form.style.storeCard": "Store / loyalty",
    "form.style.boardingPass": "Boarding pass",
    "form.platform": "Platform",
    "form.platform.google": "Google Wallet only",
    "form.platformHint":
      "Apple Wallet configuration is unavailable for now and will be activated soon.",
    "form.logoText": "Logo text",
    "form.barcode": "Barcode message",
    "form.barcodePh": "Auto-uses serial if empty",
    "form.phone": "Recipient phone (SMS)",
    "form.sendSms": "Send pass link by SMS",
    "form.background": "Background",
    "form.foreground": "Foreground",
    "form.discount": "Discount",
    "form.eventName": "Event name",
    "form.venue": "Venue",
    "form.balance": "Balance",
    "form.origin": "Origin",
    "form.destination": "Destination",
    "form.submit": "Publish pass",
    "form.publishing": "Publishing…",
    "result.title": "Pass ready",
    "result.openPage": "Open pass page",
    "result.google": "Google Wallet",
    "result.sendSms": "Send SMS link",
    "result.smsSending": "Sending…",
    "result.smsSent": "SMS sent to {{to}}",
    "result.smsDelivered": "SMS delivered via {{provider}} to {{to}}",
    "passes.title": "Passes",
    "passes.lede": "Recently published passes and their serve URLs.",
    "passes.empty": "No passes yet. Create one above.",
    "passes.open": "Open",
    "passes.google": "Google",
    "passes.sms": "SMS",
    "passes.smsSent": "Sent",
    "passes.smsTitle": "Send link to {{phone}}",
    "passes.validUntil": "Pass valid until: {{when}}",
    "setup.title": "Setup",
    "setup.lede":
      "Google Wallet credentials stay on the server. Attach a Railway volume at <code>/data</code> so passes survive deploys (no database needed).",
    "setup.storage": "Storage",
    "setup.storage.ok": "Persistent volume",
    "setup.storage.bad": "Ephemeral (lost on deploy)",
    "setup.apple": "Apple Wallet",
    "setup.apple.bad": "Unavailable for now",
    "setup.apple.note":
      "Apple Wallet configuration is unavailable for now and will be activated soon.",
    "setup.google": "Google Wallet",
    "setup.configured": "Configured",
    "setup.needsSetup": "Needs setup",
    "setup.sms": "SMS",
    "setup.provider": "Provider: {{provider}}",
    "setup.storageHintPersistent":
      "Pass data is stored on a Railway volume and survives deploys.",
    "setup.storageHintEphemeral":
      "Pass data is on ephemeral disk and will be lost on redeploy. Attach a Railway volume mounted at /data (or set DATA_DIR to the volume mount path).",
    "footer.tagline": "Google Wallet · Apple Wallet coming soon",
    "pass.meta.title": "Your pass · WalletPass for Logistics",
    "pass.loading": "Loading pass…",
    "pass.notFound": "Pass not found",
    "pass.loadError": "Could not load pass",
    "pass.addGoogle": "Add to Google Wallet",
    "pass.addApple": "Add to Apple Wallet",
    "pass.appleNote":
      "Apple Wallet is unavailable for now and will be activated soon. Use Google Wallet to save this pass.",
    "pass.device.ios": "iPhone detected — Apple Wallet is recommended for this device.",
    "pass.device.iosAppleSoon":
      "iPhone detected. Apple Wallet will be activated soon — save with Google Wallet for now.",
    "pass.device.android": "Android detected — Google Wallet is recommended for this device.",
    "pass.device.other": "Choose a wallet for your device.",
    "pass.alt.google": "Prefer Google Wallet instead?",
    "pass.alt.apple": "Prefer Apple Wallet instead?",
    "pass.metaLine": "Serial {{serial}} · Google {{google}} · Apple coming soon",
    "pass.ready": "ready",
    "pass.preview": "preview",
    "common.requestFailed": "Request failed",
    "auth.register.meta": "Register · WalletPass for Logistics",
    "auth.register.title": "Create an account",
    "auth.register.lede":
      "After registration we will email a confirmation and a one-time link to set your password.",
    "auth.register.submit": "Create account",
    "auth.register.busy": "Creating account…",
    "auth.register.failed": "Could not register",
    "auth.register.sentPrefix": "Message sent to",
    "auth.register.sentSuffix": "Open the link in the email to confirm and set a password.",
    "auth.register.emailFailed":
      "Email was not sent. Check SENDGRID_API_KEY and SENDGRID_FROM_EMAIL on Railway.",
    "auth.register.preview": "Temporary password setup link:",
    "auth.login.meta": "Log in · WalletPass for Logistics",
    "auth.login.title": "Log in",
    "auth.login.lede": "Sign in to the WalletPass for Logistics studio.",
    "auth.login.submit": "Log in",
    "auth.login.busy": "Signing in…",
    "auth.login.failed": "Could not sign in",
    "auth.forgot.meta": "Reset password · WalletPass for Logistics",
    "auth.forgot.title": "Reset password",
    "auth.forgot.lede":
      "Enter your account email — we will send a one-time link to set a new password (SendGrid).",
    "auth.forgot.submit": "Send reset link",
    "auth.forgot.busy": "Sending…",
    "auth.forgot.failed": "Could not send the link",
    "auth.forgot.preview": "Email did not go out. Temporary link:",
    "auth.setPassword.meta": "Set password · WalletPass for Logistics",
    "auth.setPassword.title": "Set password",
    "auth.setPassword.titleReset": "New password",
    "auth.setPassword.checking": "Checking link…",
    "auth.setPassword.invalid": "The link is invalid or has expired",
    "auth.setPassword.ledeSetupPrefix": "Hi {{name}}. Confirm the account for location ",
    "auth.setPassword.ledeResetPrefix": "Hi {{name}}. Set a new password for location ",
    "auth.setPassword.ledeSuffix": " ({{email}}) and choose a password.",
    "auth.setPassword.submit": "Save password and sign in",
    "auth.setPassword.submitReset": "Save new password and sign in",
    "auth.setPassword.busy": "Saving…",
    "auth.setPassword.failed": "Could not set password",
    "auth.firstName": "First name",
    "auth.lastName": "Last name",
    "auth.company": "Company / Organization",
    "auth.companyHint":
      "Enter the correct company/organization name. This name will appear on every generated pass.",
    "auth.location": "Location name / logistics park name",
    "auth.locationHint":
      "Enter a correct, recognizable location/park name. This name will appear on every pass.",
    "auth.locationPh": "must be unique",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.passwordNew": "New password",
    "auth.passwordRepeat": "Repeat password",
    "auth.passwordMismatch": "Passwords do not match",
    "auth.passwordShort": "Password must be at least 8 characters",
    "auth.haveAccount": "Already have an account?",
    "auth.noAccount": "No account yet?",
    "auth.goLogin": "Go to login",
    "auth.backLogin": "Back to login",
    "auth.forgotLink": "Forgot password?",
    "auth.setPassword": "set password",
  },
  pl: {
    "meta.title": "WalletPass for Logistics — Studio przepustek Wallet",
    "nav.create": "Utwórz",
    "nav.passes": "Przepustki",
    "nav.setup": "Konfiguracja",
    "nav.register": "Zarejestruj",
    "nav.login": "Zaloguj",
    "nav.logout": "Wyloguj",
    "lang.label": "Język",
    "hero.brand": "WalletPass for Logistics wypróbuj…",
    "hero.title": "Przepustki na park logistyczny i tereny chronione.",
    "hero.lede":
      "Utwórz testowe przepustki na park logistyczny lub inne obiekty z ograniczonym dostępem, wyślemy je do docelowego odbiorcy.",
    "hero.ctaCreate": "Utwórz przepustkę Google Wallet",
    "hero.ctaStatus": "Status walletów",
    "hero.availability":
      "Dostępne teraz: <strong>Google Wallet</strong>. Konfiguracja Apple Wallet jest na razie niedostępna i zostanie aktywowana wkrótce.",
    "create.title": "Utwórz",
    "create.lede":
      "Utwórz i opublikuj testową przepustkę Google Wallet. Opcjonalnie możesz też wysłać link SMS od razu do odbiorcy. Apple Wallet nie jest jeszcze dostępny. Kiedy przetestujesz i będziesz już gotów zobaczyć więcej, załóż konto użytkownika.",
    "form.organization": "Organizacja",
    "form.organizationPh": "Harbor Market",
    "form.description": "Opis",
    "form.descriptionPh": "Karta lojalnościowa",
    "form.style": "Typ przepustki",
    "form.style.generic": "Ogólna",
    "form.style.coupon": "Kupon",
    "form.style.eventTicket": "Bilet na wydarzenie",
    "form.style.storeCard": "Karta sklepowa / lojalnościowa",
    "form.style.boardingPass": "Karta pokładowa / wjazdowa",
    "form.platform": "Platforma",
    "form.platform.google": "Tylko Google Wallet",
    "form.platformHint":
      "Konfiguracja Apple Wallet jest na razie niedostępna i zostanie aktywowana wkrótce.",
    "form.logoText": "Tekst logo",
    "form.barcode": "Treść kodu kreskowego",
    "form.barcodePh": "Jeśli puste — użyty zostanie numer seryjny",
    "form.phone": "Telefon odbiorcy (SMS)",
    "form.sendSms": "Wyślij link do przepustki SMS-em",
    "form.background": "Tło",
    "form.foreground": "Kolor tekstu",
    "form.discount": "Zniżka",
    "form.eventName": "Nazwa wydarzenia",
    "form.venue": "Miejsce",
    "form.balance": "Saldo",
    "form.origin": "Skąd",
    "form.destination": "Dokąd",
    "form.submit": "Opublikuj przepustkę",
    "form.publishing": "Publikowanie…",
    "result.title": "Przepustka gotowa",
    "result.openPage": "Otwórz stronę przepustki",
    "result.google": "Google Wallet",
    "result.sendSms": "Wyślij link SMS",
    "result.smsSending": "Wysyłanie…",
    "result.smsSent": "SMS wysłany na {{to}}",
    "result.smsDelivered": "SMS dostarczony przez {{provider}} na {{to}}",
    "passes.title": "Przepustki",
    "passes.lede": "Ostatnio opublikowane przepustki i ich adresy URL.",
    "passes.empty": "Brak przepustek. Utwórz jedną powyżej.",
    "passes.open": "Otwórz",
    "passes.google": "Google",
    "passes.sms": "SMS",
    "passes.smsSent": "Wysłano",
    "passes.smsTitle": "Wyślij link na {{phone}}",
    "passes.validUntil": "Przepustka ważna do: {{when}}",
    "setup.title": "Konfiguracja",
    "setup.lede":
      "Dane Google Wallet zostają na serwerze. Podłącz volume Railway pod <code>/data</code>, żeby przepustki przetrwały deploye (bez bazy danych).",
    "setup.storage": "Storage",
    "setup.storage.ok": "Trwały volume",
    "setup.storage.bad": "Efemeryczny (znika po deployu)",
    "setup.apple": "Apple Wallet",
    "setup.apple.bad": "Na razie niedostępny",
    "setup.apple.note":
      "Konfiguracja Apple Wallet jest na razie niedostępna i zostanie aktywowana wkrótce.",
    "setup.google": "Google Wallet",
    "setup.configured": "Skonfigurowano",
    "setup.needsSetup": "Wymaga konfiguracji",
    "setup.sms": "SMS",
    "setup.provider": "Dostawca: {{provider}}",
    "setup.storageHintPersistent":
      "Dane przepustek są na volume Railway i przetrwają deploye.",
    "setup.storageHintEphemeral":
      "Dane są na efemerycznym dysku i znikną po redeploy. Podłącz volume Railway pod /data (albo ustaw DATA_DIR na ścieżkę mountu).",
    "footer.tagline": "Google Wallet · Apple Wallet wkrótce",
    "pass.meta.title": "Twoja przepustka · WalletPass for Logistics",
    "pass.loading": "Ładowanie przepustki…",
    "pass.notFound": "Nie znaleziono przepustki",
    "pass.loadError": "Nie udało się wczytać przepustki",
    "pass.addGoogle": "Dodaj do Google Wallet",
    "pass.addApple": "Dodaj do Apple Wallet",
    "pass.appleNote":
      "Apple Wallet jest na razie niedostępny i zostanie aktywowany wkrótce. Zapisz przepustkę w Google Wallet.",
    "pass.device.ios": "Wykryto iPhone — dla tego urządzenia rekomendujemy Apple Wallet.",
    "pass.device.iosAppleSoon":
      "Wykryto iPhone. Apple Wallet uruchomimy wkrótce — na razie zapisz w Google Wallet.",
    "pass.device.android": "Wykryto Androida — dla tego urządzenia rekomendujemy Google Wallet.",
    "pass.device.other": "Wybierz wallet dopasowany do swojego urządzenia.",
    "pass.alt.google": "Wolisz Google Wallet?",
    "pass.alt.apple": "Wolisz Apple Wallet?",
    "pass.metaLine": "Numer {{serial}} · Google {{google}} · Apple wkrótce",
    "pass.ready": "gotowy",
    "pass.preview": "podgląd",
    "common.requestFailed": "Żądanie nie powiodło się",
    "auth.register.meta": "Zarejestruj · WalletPass for Logistics",
    "auth.register.title": "Zarejestruj konto",
    "auth.register.lede":
      "Po rejestracji wyślemy e-mail z potwierdzeniem i jednorazowym linkiem do utworzenia hasła.",
    "auth.register.submit": "Utwórz konto",
    "auth.register.busy": "Tworzenie konta…",
    "auth.register.failed": "Nie udało się zarejestrować",
    "auth.register.sentPrefix": "Wiadomość została wysłana na",
    "auth.register.sentSuffix": "Otwórz link z e-maila, aby potwierdzić adres i ustawić hasło.",
    "auth.register.emailFailed":
      "E-mail nie został wysłany. Sprawdź SENDGRID_API_KEY i SENDGRID_FROM_EMAIL na Railway.",
    "auth.register.preview": "Tymczasowy link do ustawienia hasła:",
    "auth.login.meta": "Zaloguj · WalletPass for Logistics",
    "auth.login.title": "Zaloguj",
    "auth.login.lede": "Zaloguj się do studio WalletPass for Logistics.",
    "auth.login.submit": "Zaloguj",
    "auth.login.busy": "Logowanie…",
    "auth.login.failed": "Nie udało się zalogować",
    "auth.forgot.meta": "Reset hasła · WalletPass for Logistics",
    "auth.forgot.title": "Reset hasła",
    "auth.forgot.lede":
      "Podaj e-mail konta — wyślemy jednorazowy link do ustawienia nowego hasła (SendGrid).",
    "auth.forgot.submit": "Wyślij link resetu",
    "auth.forgot.busy": "Wysyłanie…",
    "auth.forgot.failed": "Nie udało się wysłać linku",
    "auth.forgot.preview": "E-mail nie wyszedł. Link tymczasowy:",
    "auth.setPassword.meta": "Ustaw hasło · WalletPass for Logistics",
    "auth.setPassword.title": "Ustaw hasło",
    "auth.setPassword.titleReset": "Nowe hasło",
    "auth.setPassword.checking": "Sprawdzanie linku…",
    "auth.setPassword.invalid": "Link jest nieprawidłowy lub wygasł",
    "auth.setPassword.ledeSetupPrefix": "Cześć {{name}}. Potwierdź konto dla lokalizacji ",
    "auth.setPassword.ledeResetPrefix": "Cześć {{name}}. Ustaw nowe hasło dla lokalizacji ",
    "auth.setPassword.ledeSuffix": " ({{email}}) i wybierz hasło.",
    "auth.setPassword.submit": "Zapisz hasło i zaloguj",
    "auth.setPassword.submitReset": "Zapisz nowe hasło i zaloguj",
    "auth.setPassword.busy": "Zapisywanie…",
    "auth.setPassword.failed": "Nie udało się ustawić hasła",
    "auth.firstName": "Imię",
    "auth.lastName": "Nazwisko",
    "auth.company": "Firma/Organizacja",
    "auth.companyHint":
      "Podaj poprawną nazwę firmy/organizacja. Ta nazwa będzie elementem widocznym na każdej generowanej przepustce.",
    "auth.location": "Nazwa Lokalizacji/ nazwa Parku Logistycznego",
    "auth.locationHint":
      "Podaj poprawną i rozpoznawalną nazwę lokalizacji/parku. Ta nazwa będzie elementem widocznym na każdej przepustce",
    "auth.locationPh": "musi być unikalna",
    "auth.email": "E-mail",
    "auth.password": "Hasło",
    "auth.passwordNew": "Nowe hasło",
    "auth.passwordRepeat": "Powtórz hasło",
    "auth.passwordMismatch": "Hasła nie są takie same",
    "auth.passwordShort": "Hasło musi mieć co najmniej 8 znaków",
    "auth.haveAccount": "Masz już konto?",
    "auth.noAccount": "Nie masz konta?",
    "auth.goLogin": "Przejdź do logowania",
    "auth.backLogin": "Wróć do logowania",
    "auth.forgotLink": "Nie pamiętasz hasła?",
    "auth.setPassword": "ustaw hasło",
  },
};

/** @type {Locale} */
let currentLocale = detectInitialLocale();

/** @type {Set<() => void>} */
const listeners = new Set();

/** @returns {Locale} */
function detectInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "pl" || stored === "en") return stored;
  } catch {
    // ignore
  }
  // Polish is the site default (primary for Google indexing and first visit).
  // English is opted into via the language switch.
  return "pl";
}

/** @returns {Locale} */
export function getLocale() {
  return currentLocale;
}

/**
 * @param {string} key
 * @param {Record<string, string | number>=} vars
 */
export function t(key, vars) {
  const table = messages[currentLocale] || messages.pl;
  let value = table[key] ?? messages.pl[key] ?? messages.en[key] ?? key;
  if (vars) {
    for (const [name, raw] of Object.entries(vars)) {
      value = value.replaceAll(`{{${name}}}`, String(raw));
    }
  }
  return value;
}

/** @param {Locale} locale */
export function setLocale(locale) {
  if (locale !== "pl" && locale !== "en") return;
  if (locale === currentLocale) {
    applyDomTranslations(document);
    return;
  }
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  applyDomTranslations(document);
  for (const listener of listeners) listener();
}

/** @param {() => void} listener */
export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @param {ParentNode} root */
export function applyDomTranslations(root = document) {
  document.documentElement.lang = currentLocale;

  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const mode = el.getAttribute("data-i18n-mode") || "text";
    const value = t(key);
    // Missing key → t() returns the key. Keep authored HTML fallback (helps when
    // a CDN still serves a stale i18n.js after deploy).
    if (value === key) {
      const existing =
        mode === "html" ? el.innerHTML.trim() : (el.textContent || "").trim();
      if (existing && existing !== key) return;
    }
    if (mode === "html") el.innerHTML = value;
    else el.textContent = value;
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key || !("placeholder" in el)) return;
    const value = t(key);
    if (value === key && el.placeholder && el.placeholder !== key) return;
    el.placeholder = value;
  });

  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;
    el.setAttribute("title", t(key));
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (!key) return;
    el.setAttribute("aria-label", t(key));
  });

  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) {
    const key = titleEl.getAttribute("data-i18n");
    if (key) document.title = t(key);
  }

  root.querySelectorAll(".lang-switch [data-lang]").forEach((btn) => {
    const lang = btn.getAttribute("data-lang");
    const active = lang === currentLocale;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

/** Wire header language buttons inside `root`. */
export function bindLanguageSwitch(root = document) {
  root.querySelectorAll(".lang-switch").forEach((group) => {
    if (group.dataset.langBound === "1") return;
    group.dataset.langBound = "1";
    group.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("[data-lang]");
      if (!btn || !group.contains(btn)) return;
      event.preventDefault();
      const lang = btn.getAttribute("data-lang");
      if (lang === "pl" || lang === "en") setLocale(lang);
    });
  });
}

export function initI18n(root = document) {
  bindLanguageSwitch(root);
  applyDomTranslations(root);
}
