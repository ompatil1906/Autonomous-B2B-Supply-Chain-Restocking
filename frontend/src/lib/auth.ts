/**
 * Warden API token handling.
 *
 * A token is attached ONLY to write requests, via the X-Warden-Token header —
 * never to URLs, bodies, logs, telemetry or rendered UI.
 *
 * Resolution order:
 *   1. VITE_WARDEN_TOKEN  — injected at build time (production/staging override)
 *   2. Configuration -> localStorage (this browser only)
 *   3. Inbuilt development/demo token — matches the backend's well-known dev
 *      token so the demo runs with ZERO configuration. Judges never need to
 *      add a token. Production servers reject it (401) unless WARDEN_API_TOKEN
 *      is set there, in which case you must provide the real one.
 */
const LS_KEY = "warden.api_token";
const INBUILT_DEV_TOKEN = "warden-dev-token";

export type TokenSource = "env" | "stored" | "inbuilt";

export function tokenSource(): TokenSource {
  const envToken = (import.meta.env.VITE_WARDEN_TOKEN as string | undefined)?.trim() ?? "";
  if (envToken) return "env";
  try {
    if ((localStorage.getItem(LS_KEY) ?? "").trim()) return "stored";
  } catch {
    /* fall through to inbuilt */
  }
  return "inbuilt";
}

export function getWardenToken(): string {
  const envToken = (import.meta.env.VITE_WARDEN_TOKEN as string | undefined)?.trim() ?? "";
  if (envToken) return envToken;
  try {
    const stored = (localStorage.getItem(LS_KEY) ?? "").trim();
    if (stored) return stored;
  } catch {
    /* fall through to inbuilt */
  }
  return INBUILT_DEV_TOKEN;
}

export function setWardenToken(token: string): void {
  try {
    if (token.trim()) localStorage.setItem(LS_KEY, token.trim());
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* storage unavailable — token simply won't persist */
  }
}

export function clearWardenToken(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

export function hasWardenToken(): boolean {
  return getWardenToken().length > 0;
}

export const inbuiltToken = INBUILT_DEV_TOKEN;