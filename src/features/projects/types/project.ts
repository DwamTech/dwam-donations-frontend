export type MinorAmount = number | string;
export type PublicProjectState = "active" | "funded" | "expired" | "closed" | "upcoming" | "reserved" | "unavailable";
export type ProjectMedia = {
  id: number; uuid: string; type: "image" | "video"; url: string | null;
  mime_type: string | null; caption: string | null; sort_order: number;
};
export type DonationProject = {
  id: number; uuid: string; reference: string; title: string;
  short_description: string | null; description: string | null;
  country_code: string | null; beneficiary_count: number | null;
  category: { id: number | null; name: string | null; slug: string | null };
  currency: string; target_amount_minor: MinorAmount; collected_amount_minor: MinorAmount;
  remaining_amount_minor: MinorAmount; progress_percent: number;
  financial_status: "collecting" | "fully_reserved" | "goal_reached";
  public_state: PublicProjectState;
  accepts_donations: boolean;
  cover_image: ProjectMedia | null; gallery_images: ProjectMedia[]; videos: ProjectMedia[];
  acceptance_starts_at: string | null; acceptance_ends_at: string | null;
};
export type ProjectPage = {
  data: DonationProject[];
  links: { first: string; last: string; prev: string | null; next: string | null };
  meta: { current_page: number; last_page: number; per_page: number; total: number;
    from: number | null; to: number | null; path: string;
    links: { url: string | null; label: string; active: boolean }[] };
};
