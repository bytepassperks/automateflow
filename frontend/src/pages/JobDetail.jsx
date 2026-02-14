import { useParams } from 'react-router-dom';
import { useJob, useCancelJob, useHandoffComplete } from '../hooks/useJobs';
import JobStatusBadge from '../components/JobStatusBadge';
import LiveBrowserViewer from '../components/LiveBrowserViewer';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

function proxyScreenshotUrl(url) {
  if (!url) return url;
  const bucket = 'crop-spray-uploads';
  const idx = url.indexOf(`/${bucket}/`);
  if (idx !== -1) {
    const key = url.substring(idx + bucket.length + 2);
    return `${API_URL}/api/screenshots/${key}`;
  }
  return url;
}

export default function JobDetail() {
  const { id } = useParams();
  const { data, isLoading } = useJob(id);
  const cancelJob = useCancelJob();
  const handoffComplete = useHandoffComplete();

  const job = data?.job;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Job not found</p>
      </div>
    );
  }

  const isRunning = job.status === 'processing' || job.status === 'queued';

  const handleCancel = async () => {
    try {
      await cancelJob.mutateAsync(job.id);
      toast.success('Job canceled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel job');
    }
  };

  const handleHandoffComplete = async () => {
    try {
      await handoffComplete.mutateAsync(job.id);
      toast.success('Handoff completion signaled');
    } catch (err) {
      toast.error('Failed to signal handoff');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{job.name}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Created {new Date(job.createdAt).toLocaleString()}</span>
            {job.startedAt && <span>Started {new Date(job.startedAt).toLocaleString()}</span>}
            {job.completedAt && <span>Completed {new Date(job.completedAt).toLocaleString()}</span>}
            {job.executionTime && <span>Duration: {(job.executionTime / 1000).toFixed(1)}s</span>}
          </div>
        </div>
        {isRunning && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-red-600/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-600/30 transition-colors border border-red-500/20"
          >
            Cancel Job
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <LiveBrowserViewer
            jobId={job.id}
            screenshots={job.screenshots || []}
            isRunning={isRunning}
          />

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Handoff Controls</h3>
            <p className="text-xs text-gray-400 mb-3">
              If the browser agent encounters a CAPTCHA or OTP and you&apos;ve solved it externally, click below to resume.
            </p>
            <button
              onClick={handleHandoffComplete}
              disabled={!isRunning}
              className="px-4 py-2 bg-green-600/20 text-green-400 text-sm font-medium rounded-lg hover:bg-green-600/30 transition-colors border border-green-500/20 disabled:opacity-30"
            >
              CAPTCHA/OTP Solved - Resume
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {job.taskDescription && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Task Description</h3>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{job.taskDescription}</p>
            </div>
          )}

          {Object.keys(job.parameters || {}).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Parameters</h3>
              <pre className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3 overflow-x-auto font-mono">
                {JSON.stringify(job.parameters, null, 2)}
              </pre>
            </div>
          )}

          {job.result && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Result</h3>
              <pre className="text-sm text-green-300 bg-gray-800 rounded-lg p-3 overflow-x-auto font-mono">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </div>
          )}

          {job.error && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-red-400 mb-3">Error</h3>
              <p className="text-sm text-red-300">{job.error}</p>
            </div>
          )}

          {job.logs && job.logs.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Logs</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {job.logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-gray-600 font-mono shrink-0 w-6 text-right">{i + 1}</span>
                    <span className="text-gray-300">{typeof log === 'string' ? log : JSON.stringify(log)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {job.screenshots && job.screenshots.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">
                Screenshots ({job.screenshots.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {job.screenshots.map((url, i) => (
                  <a key={i} href={proxyScreenshotUrl(url)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={proxyScreenshotUrl(url)}
                      alt={`Screenshot ${i + 1}`}
                      className="rounded-lg border border-gray-800 hover:border-primary-500 transition-colors"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
