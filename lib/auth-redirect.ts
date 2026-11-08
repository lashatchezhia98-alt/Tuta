const productionOrigin = "https://tutahealth.ge";

// Never bake a local development address into a customer's confirmation email.
export function authRedirectBase(configured: string | undefined, currentOrigin: string) {
  for (const candidate of [configured?.trim(), currentOrigin]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      const local = /^(localhost|0\.0\.0\.0|127\..*|\[::1\])$/.test(url.hostname)
        || url.hostname.endsWith(".localhost");
      if (url.protocol === "https:" && !local && !url.username && !url.password)
        return url.origin;
    } catch { /* An invalid optional setting must not break account recovery. */ }
  }
  return productionOrigin;
}
