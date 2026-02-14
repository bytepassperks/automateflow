import { useState } from 'react';
import { useCreateJob } from '../hooks/useJobs';
import { useTemplates } from '../hooks/useTemplates';
import toast from 'react-hot-toast';

export default function CreateJobModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('custom');
  const [name, setName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [parameters, setParameters] = useState('{}');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [priority, setPriority] = useState(5);

  const { data: templatesData } = useTemplates();
  const createJob = useCreateJob();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    let parsedParams = {};
    try {
      parsedParams = JSON.parse(parameters);
    } catch {
      toast.error('Invalid JSON in parameters');
      return;
    }

    try {
      await createJob.mutateAsync({
        name,
        taskDescription: mode === 'custom' ? taskDescription : undefined,
        templateId: mode === 'template' ? templateId : undefined,
        parameters: parsedParams,
        webhookUrl: webhookUrl || undefined,
        priority,
      });
      toast.success('Job created successfully');
      onClose();
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create job');
    }
  };

  const resetForm = () => {
    setName('');
    setTaskDescription('');
    setTemplateId('');
    setParameters('{}');
    setWebhookUrl('');
    setPriority(5);
    setMode('custom');
  };

  const selectedTemplate = templatesData?.templates?.find((t) => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Create New Job</h2>
          <p className="text-sm text-gray-400 mt-1">Run a browser automation task</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                mode === 'custom'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              Custom Task
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                mode === 'template'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              Use Template
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Job Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., Scrape competitor pricing"
              required
            />
          </div>

          {mode === 'custom' ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Task Description</label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Describe what you want the browser agent to do..."
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Template</label>
              <select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  const tmpl = templatesData?.templates?.find((t) => t.id === e.target.value);
                  if (tmpl) {
                    const defaultParams = {};
                    if (tmpl.parameters?.properties) {
                      Object.keys(tmpl.parameters.properties).forEach((key) => {
                        defaultParams[key] = tmpl.parameters.properties[key].default || '';
                      });
                    }
                    setParameters(JSON.stringify(defaultParams, null, 2));
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Select a template...</option>
                {templatesData?.templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="text-xs text-gray-500 mt-1.5">{selectedTemplate.description}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Parameters (JSON)</label>
            <textarea
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder='{"key": "value"}'
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Priority: {priority}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10))}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Webhook URL (optional)</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://your-server.com/webhook"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createJob.isPending}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 transition-colors disabled:opacity-50"
            >
              {createJob.isPending ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
