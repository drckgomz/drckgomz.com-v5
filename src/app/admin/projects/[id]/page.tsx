import ManagementPage,{Unavailable} from '@/components/admin/management/ManagementPage';
import {requireManagementOwner} from '@/lib/admin/management';
import {resourceEditor,projectDefaults} from '@/lib/admin/resource-editor';
export default async function ProjectEditor({params}:{params:Promise<{id:string}>}) {
  await requireManagementOwner();const{id}=await params;
  const editor=await resourceEditor('projects',id,projectDefaults);
  return <ManagementPage title="Edit project" description="Manage project content, technology tags, links and publication.">{editor??<Unavailable>The transactional project backend is not installed. No record has been loaded and no changes were made.</Unavailable>}</ManagementPage>;
}
