export function ProjectUnavailable({ retryHref = "/projects" }: { retryHref?: string }) {
  return <div className="notice" role="status"><h3>نعود إليك بالمشاريع قريبًا</h3><p>تعذّر تحميل المشاريع حاليًا. يرجى إعادة المحاولة بعد قليل.</p><a className="outline-link" href={retryHref}>إعادة المحاولة ←</a></div>;
}
export function ProjectsLoading() {
  return <section className="section" role="status" aria-live="polite" aria-busy="true"><p>جارٍ تحميل المشاريع…</p><div className="projects-grid" aria-hidden="true">{[1, 2, 3].map(n => <div className="skeleton" key={n} />)}</div></section>;
}
