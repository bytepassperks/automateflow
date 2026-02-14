import { useNavigate } from 'react-router-dom';

const categoryColors = {
  Scraping: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Monitoring: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Automation: 'bg-green-500/10 text-green-400 border-green-500/20',
  Utility: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Document: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export default function TemplateCard({ template }) {
  const navigate = useNavigate();
  const colorClass = categoryColors[template.category] || categoryColors.Utility;

  return (
    <div
      onClick={() => navigate(`/templates/${template.slug}`)}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 cursor-pointer transition-all hover:shadow-lg hover:shadow-primary-900/10"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
          {template.category}
        </span>
        <div className="text-right">
          <p className="text-xs text-gray-500">{template.successRate}% success</p>
        </div>
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{template.name}</h3>
      <p className="text-sm text-gray-400 line-clamp-2 mb-4">{template.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {template.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-500">{template.usageCount} runs</span>
      </div>
    </div>
  );
}
