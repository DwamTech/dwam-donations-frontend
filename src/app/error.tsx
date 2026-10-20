"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="section empty-state" role="alert"><h1>تعذّر عرض الصفحة</h1><p>يرجى المحاولة مرة أخرى.</p><button className="primary-button" onClick={reset}>إعادة المحاولة</button></section>;
}
