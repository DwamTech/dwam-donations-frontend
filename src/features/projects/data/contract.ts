import type { DonationProject, ProjectPage } from "../types/project";
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const nullableString = (value: unknown) => value === null || typeof value === "string";
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const money = (value: unknown) => (integer(value) && value >= 0) || (typeof value === "string" && /^\d+$/.test(value));
const media = (value: unknown): boolean => object(value) && integer(value.id) && typeof value.uuid === "string"
  && ["image", "video"].includes(String(value.type)) && nullableString(value.url)
  && nullableString(value.mime_type) && nullableString(value.caption) && integer(value.sort_order);
/** Reject malformed or imprecise finances instead of rendering fabricated defaults. */
export function parseProjectPage(payload: unknown): ProjectPage {
  if (!object(payload) || !Array.isArray(payload.data) || !object(payload.meta) || !object(payload.links)) throw new Error("Invalid collection");
  const meta = payload.meta;
  if (![meta.current_page, meta.last_page, meta.per_page].every(n => integer(n) && n >= 1)
    || !integer(meta.total) || meta.total < 0) throw new Error("Invalid pagination");
  if (![meta.from, meta.to].every(n => n === null || integer(n)) || typeof meta.path !== "string"
    || !Array.isArray(meta.links) || !meta.links.every(link => object(link) && nullableString(link.url)
      && typeof link.label === "string" && typeof link.active === "boolean")
    || ![payload.links.first, payload.links.last].every(link => typeof link === "string")
    || ![payload.links.prev, payload.links.next].every(nullableString)) throw new Error("Invalid pagination links");
  const data = payload.data.map(parseProject);
  return { ...payload, data } as ProjectPage;
}

export function parseProject(value: unknown): DonationProject {
  // Laravel serializes an absent eager-loaded category relationship as null.
  // Keep the presentation model stable without inventing a category identity.
  const p = object(value) && value.category === null
    ? { ...value, category: { id: null, name: null, slug: null } }
    : value;
  if (!object(p) || !integer(p.id) || ![p.uuid, p.title, p.reference].every(s => typeof s === "string")
      || ![p.short_description, p.description, p.country_code, p.acceptance_starts_at, p.acceptance_ends_at].every(nullableString)
      || !(p.beneficiary_count === null || integer(p.beneficiary_count))
      || !object(p.category) || !(p.category.id === null || integer(p.category.id)) || !nullableString(p.category.name) || !nullableString(p.category.slug)
      || typeof p.currency !== "string" || !/^[A-Z]{3}$/.test(p.currency)
      || ![p.target_amount_minor, p.collected_amount_minor, p.remaining_amount_minor].every(money)
      || typeof p.progress_percent !== "number" || !Number.isFinite(p.progress_percent)
      || !["collecting", "fully_reserved", "goal_reached"].includes(String(p.financial_status))
      || !["active", "funded", "expired", "closed", "upcoming", "reserved", "unavailable"].includes(String(p.public_state))
      || typeof p.accepts_donations !== "boolean" || p.accepts_donations !== (p.public_state === "active")
      || !(p.cover_image === null || media(p.cover_image))
      || !Array.isArray(p.gallery_images) || !p.gallery_images.every(media)
      || !Array.isArray(p.videos) || !p.videos.every(media)) throw new Error("Invalid public project");
  return p as DonationProject;
}

export function parseProjectDetail(payload: unknown): DonationProject {
  if (!object(payload)) throw new Error("Invalid detail envelope");
  return parseProject(payload.data);
}
