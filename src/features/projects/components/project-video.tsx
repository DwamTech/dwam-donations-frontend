"use client";
import { useState } from "react";

export function ProjectVideo({ src, mime, label }: { src: string; mime: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p className="video-unavailable" role="status">تعذّر تشغيل الفيديو حاليًا.</p>;
  return <><video controls playsInline preload="none" aria-label={label} onError={() => setFailed(true)}><source src={src} type={mime} />متصفحك لا يدعم تشغيل هذا الفيديو.</video><a className="outline-link" href={src} target="_blank" rel="noopener noreferrer">فتح ملف الفيديو في نافذة جديدة ←</a></>;
}
