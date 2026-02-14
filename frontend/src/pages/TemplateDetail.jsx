import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTemplate } from '../hooks/useTemplates';
import { useCreateJob } from '../hooks/useJobs';
import toast from 'react-hot-toast';

export default function TemplateDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useTemplate(slug);
  const createJob = useCreateJob();
  const [parameters, setParameters] = useState('{}');
  const [jobName, setJobName] = useState('');

  const template = data?.template;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Template not found</p>
      </div>
    );
  }

  const handleRun = async (e) => {
    e.preventDefault();
    let parsedParams = {};
    try {
      parsedParams = JSON.parse(parameters);
    } catch {
      toast.error('Invalid JSON parameters');
      return;
    }

    try {
      const result = await createJob.mutateAsync({
        name: jobName || `${template.name} - ${new Date().toLocaleString()}`,
        templateId: template.id,
        parameters: parsedParams,
      });
      toast.success('Job created!');
      navigate(`/jobs/${result.job.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create job');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">{template.name}</h1>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
            {template.category}
          </span>
        </div>
        <p className="text-gray-400">{template.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Run This Template</h3>
            <form onSubmit={handleRun} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Job Name</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={`${template.name} run`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Parameters (JSON)</label>
                <textarea
                  value={parameters}
                  onChange={(e) => setParameters(e.target.value)}
                  rows={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={createJob.isPending}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 transition-colors disabled:opacity-50"
              >
                {createJob.isPending ? 'Creating...' : 'Run Template'}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Success Rate</dt>
                <dd className="text-sm text-gray-200 font-medium">{template.successRate}%</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Total Runs</dt>
                <dd className="text-sm text-gray-200 font-medium">{template.usageCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Category</dt>
                <dd className="text-sm text-gray-200 font-medium">{template.category}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Required Fields</h3>
            <div className="space-y-2">
              {template.requiredFields?.map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                  <span className="text-sm text-gray-300">{field}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Parameter Schema</h3>
            <pre className="text-xs text-gray-400 bg-gray-800 rounded-lg p-3 overflow-x-auto font-mono">
              {JSON.stringify(template.parameters, null, 2)}
            </pre>
          </div>

          {template.tags?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
