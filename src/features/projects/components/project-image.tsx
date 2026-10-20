"use client";
import Image from "next/image";
import { useState } from "react";
import { publicMediaUrl } from "../data/presentation";

/** Browser-only load failure handling; the API and all financial data stay server-side. */
export function ProjectImage({ src, alt, eager = false }: { src: string | null; alt: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = publicMediaUrl(src);
  return url && !failed
    ? <Image unoptimized src={url} alt={alt} width={1280} height={800} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />
    : <div className="media-fallback" role="img" aria-label={alt}><span>{failed ? "تعذّر عرض الصورة" : "لا تتوفر صورة لهذا المشروع"}</span></div>;
}
