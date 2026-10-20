type PdfBrowser = {
  create: (blob: Blob) => string; revoke: (url: string) => void;
  click: (url: string, filename: string) => void;
};
/** A temporary browser download target, revoked after dispatch or on unmount. */
export function createPdfOffer(browser: PdfBrowser = {
  create: blob => URL.createObjectURL(blob), revoke: url => URL.revokeObjectURL(url),
  click(url, filename) {
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.referrerPolicy = "no-referrer";
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
  },
}, lifetimeMs = 30000) {
  let url: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function clear() { if (timer) clearTimeout(timer); if (url) browser.revoke(url); url = null; timer = undefined; }
  function offer(blob: Blob, filename: string) {
    clear(); url = browser.create(blob);
    try { browser.click(url, filename); timer = setTimeout(clear, lifetimeMs); }
    catch (error) { clear(); throw error; }
  }
  return { offer, dispose: clear };
}
