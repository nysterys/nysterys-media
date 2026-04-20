/**
 * Open a URL in a centered popup window.
 * Only http/https URLs are allowed — javascript: and other protocols are blocked.
 */
export function openPopup(url, width = 480, height = 720) {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return;
  } catch {
    return;
  }
  const left = Math.round(window.screenX + (window.outerWidth  - width)  / 2);
  const top  = Math.round(window.screenY + (window.outerHeight - height) / 2);
  window.open(url, '_blank',
    `width=${width},height=${height},left=${left},top=${top},` +
    `toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}
