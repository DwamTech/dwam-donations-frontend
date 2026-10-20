import type { DonationProject } from "../types/project";
import { galleryImages, playableVideo } from "../data/presentation";
import { ProjectImage } from "./project-image";
import { ProjectVideo } from "./project-video";

export function ProjectMedia({ project }: { project: DonationProject }) {
  const images = galleryImages(project.gallery_images);
  return <section className="detail-media" aria-label="صور وفيديو المشروع">
    <figure className="cover-figure"><ProjectImage key={project.cover_image?.url} src={project.cover_image?.url ?? null} alt={project.cover_image?.caption || project.title} eager />{project.cover_image?.caption && <figcaption>{project.cover_image.caption}</figcaption>}</figure>
    {images.length > 0 && <div className="detail-gallery">{images.map(image => <figure key={image.uuid}><ProjectImage src={image.url} alt={image.caption || `صورة من مشروع ${project.title}`} />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}</div>}
    {project.videos.length > 0 && <div className="detail-videos"><h2>من المشروع</h2>{project.videos.map(video => {
      const src = playableVideo(video);
      return <figure key={video.uuid}>{src ? <ProjectVideo src={src} mime={video.mime_type!} label={video.caption || `فيديو مشروع ${project.title}`} /> : <p className="video-unavailable">لا تتوفر صيغة فيديو قابلة للتشغيل هنا.</p>}{video.caption && <figcaption>{video.caption}</figcaption>}</figure>;
    })}</div>}
  </section>;
}
