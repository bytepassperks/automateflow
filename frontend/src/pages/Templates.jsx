import { useTemplates } from '../hooks/useTemplates';
import TemplateCard from '../components/TemplateCard';

export default function Templates() {
  const { data, isLoading } = useTemplates();
  const templates = data?.templates || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Templates</h1>
        <p className="text-gray-400 mt-1">Pre-built automation templates ready to use</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>No templates available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
