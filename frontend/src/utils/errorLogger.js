const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';

/**
 * Sends an error to the backend logger and returns the error number (e.g. "ERR-42").
 * Never throws — logging failures are silently swallowed so they don't cause more errors.
 *
 * @param {object} opts
 * @param {'frontend'|'backend'} opts.type
 * @param {string} opts.component  - page or function name, e.g. "ClientsPage"
 * @param {string|Error} opts.error - the caught error object or message string
 * @param {string} [opts.url]      - defaults to window.location.href
 * @returns {Promise<string|null>} error number like "ERR-42", or null if logging failed
 */
export async function logError({ type = 'frontend', component, error, url }) {
  try {
    const message = error instanceof Error ? error.message : String(error || '');
    const stack   = error instanceof Error ? (error.stack || '') : '';
    const userId  = (() => {
      try { return JSON.parse(localStorage.getItem('user') || '{}').id || ''; }
      catch { return ''; }
    })();

    const res = await fetch(`${BACKEND_URL}/api/errors/log`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        component,
        message,
        stack,
        url: url || window.location.href,
        user_id: userId,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.error_number || null;
  } catch {
    return null;
  }
}

/**
 * Wraps logError and appends the error number to a toast message string.
 * Returns the full message so you can pass it directly to toast.error().
 *
 * Example:
 *   toast.error(await toastMsg('ClientsPage', err, 'Failed to load clients'));
 */
export async function toastMsg(component, error, fallback = 'Something went wrong') {
  const num = await logError({ component, error });
  return num ? `${fallback} (${num})` : fallback;
}
