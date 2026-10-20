import { ProjectCard } from "@/components/project-card";
import type { DonationProject } from "@/features/projects/types/project";
import type { ProjectQuery } from "@/features/projects/data/query";
export function ProjectGrid({ projects, discoveryQuery }: { projects: DonationProject[]; discoveryQuery?: ProjectQuery }) {
  if (!projects.length) return <div className="empty-state" role="status"><h3>لا توجد مشاريع في هذه الصفحة</h3><p>يمكنك العودة إلى أول صفحة أو زيارة المنصة لاحقًا للاطلاع على المشاريع المنشورة.</p></div>;
  return <div className="projects-grid">{projects.map(project => <ProjectCard key={project.uuid} project={project} discoveryQuery={discoveryQuery} />)}</div>;
}
