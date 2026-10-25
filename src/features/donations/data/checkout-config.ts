export type CheckoutConfig = Readonly<{ enabled: boolean; gateway: string; hosts: readonly string[]; authenticated?: boolean }>;
export const disabledCheckout: CheckoutConfig = Object.freeze({ enabled: false, gateway: "", hosts: Object.freeze([]) });
export function checkoutConfig(env: Record<string, string | undefined>): CheckoutConfig {
  const gateway = env.DONATIONS_GATEWAY_CODE ?? "";
  const hosts = (env.DONATIONS_CHECKOUT_HOSTS ?? "").split(",").map(host => host.trim());
  const validHosts = hosts.length > 0 && hosts.every(host => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host));
  let validReturn = false;
  try {
    const url = new URL(env.DONATIONS_VERIFIED_RETURN_URL ?? "");
    const origin = new URL(env.SITE_ORIGIN ?? "");
    validReturn = url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.origin === origin.origin && url.pathname !== "/";
  } catch { /* Missing configuration closes the gate. */ }
  if (env.DONATIONS_MUTATIONS_ENABLED !== "true" || env.DONATIONS_INTEGRATION_VERIFIED !== "true" || env.DONATIONS_PAYMENT_RETURN_VERIFIED !== "true" || !validReturn || !validHosts || !/^[A-Za-z0-9_-]{1,50}$/.test(gateway)) return disabledCheckout;
  return Object.freeze({ enabled: true, gateway, hosts: Object.freeze([...hosts]) });
}
