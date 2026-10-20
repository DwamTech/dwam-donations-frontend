import type { ProjectMedia } from "../types/project";

export function projectId(value: string) {
  return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt("9223372036854775807") ? value : null;
}
export function publicMediaUrl(value: string | null | undefined) {
  if (!value || /[\s\\\u0000-\u001f]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function playableVideo(media: ProjectMedia) {
  return media.type === "video" && ["video/mp4", "video/webm", "video/ogg"].includes(media.mime_type ?? "")
    ? publicMediaUrl(media.url) : null;
}
/** Preserve API order: Laravel has already sorted by sort_order, then id. */
export function galleryImages(images: ProjectMedia[]) {
  return images.filter(image => image.type === "image" && publicMediaUrl(image.url));
}
export function projectDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(value));
}
export function descriptionText(project: { short_description: string | null; description: string | null }) {
  return (project.short_description || project.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}
export const fundingLabels = { collecting: "قيد التمويل", fully_reserved: "التمويل المتبقي محجوز", goal_reached: "اكتمل هدف التمويل" };
