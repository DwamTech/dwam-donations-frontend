/** Only an explicit HTTP(S) origin can identify public pages. */
export function publicOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch { return undefined; }
}
export const site = {
  name: "منصة التبرعات",
  tagline: "عطاءٌ يبدأ بك",
  description: "اكتشف مشاريع التبرع المنشورة، وتعرّف إلى أهدافها وتقدّم تمويلها بوضوح.",
  origin: publicOrigin(process.env.SITE_ORIGIN),
};
export function canonical(path: string) {
  if (!site.origin || !path.startsWith("/") || path.startsWith("//")) return undefined;
  const url = new URL(path, site.origin);
  return url.origin === site.origin ? url.toString() : undefined;
}
