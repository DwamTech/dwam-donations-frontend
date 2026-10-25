/** Synthetic test-only contract fixture. Never imported by application code. */
export function fixturePage(page = 1) {
  return {
    data: [{ id: 1, uuid: "test-project", reference: "TEST-01", title: "مشروع اختبار العقد",
      short_description: null, description: null, country_code: null, beneficiary_count: null,
      category: { id: null, name: null, slug: null }, currency: "EGP", target_amount_minor: 10000,
      collected_amount_minor: 1234, remaining_amount_minor: 8766, progress_percent: 12.34,
      financial_status: "collecting", public_state: "active", accepts_donations: true, cover_image: null, gallery_images: [], videos: [],
      acceptance_starts_at: null, acceptance_ends_at: null }],
    links: { first: "http://localhost/api/donation-projects?page=1", last: "http://localhost/api/donation-projects?page=2", prev: null, next: "http://localhost/api/donation-projects?page=2" },
    meta: { current_page: page, last_page: 2, per_page: 12, total: 13, from: 1, to: 12, path: "http://localhost/api/donation-projects", links: [] },
  };
}

export function fixtureDetail() {
  const image = (id, caption, sort_order) => ({ id, uuid: `media-${id}`, type: "image", url: `/storage/image-${id}.jpg`, mime_type: "image/jpeg", caption, sort_order });
  return { ...fixturePage().data[0], title: "مشروع تفاصيل منشور للاختبار", reference: "DETAIL-01", country_code: "EG",
    beneficiary_count: 25, category: { id: 3, name: "التعليم", slug: "education" },
    short_description: "ملخص حقيقي من بيانات الاختبار المعزولة",
    description: "فقرة أولى عن المشروع.\n\n" + "وصف طويل يحافظ على تفاصيل المشروع. ".repeat(120) + "\n<script>alert('unsafe')</script>",
    remaining_amount_minor: 8000,
    cover_image: { ...image(10, "غلاف الاختبار", 0), url: "https://media.example.test/cover.jpg" },
    gallery_images: [image(11, "الصورة الأولى في المعرض", 1), image(12, "الصورة الثانية في المعرض", 2)],
    videos: [
      { id: 20, uuid: "video-mp4", type: "video", url: "/storage/video.mp4", mime_type: "video/mp4", caption: "فيديو الاختبار", sort_order: 0 },
      { id: 21, uuid: "video-unknown", type: "video", url: "https://untrusted.example.test/embed", mime_type: null, caption: "فيديو غير مدعوم", sort_order: 1 },
    ],
    acceptance_starts_at: "2026-10-01T00:00:00.000Z", acceptance_ends_at: "2026-12-01T00:00:00.000Z",
  };
}
