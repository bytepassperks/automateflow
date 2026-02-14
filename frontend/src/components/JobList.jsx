import { useNavigate } from 'react-router-dom';
import JobStatusBadge from './JobStatusBadge';

export default function JobList({ jobs, showTemplate = true }) {
  const navigate = useNavigate();

  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No jobs found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            {showTemplate && (
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
            )}
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {jobs.map((job) => (
            <tr
              key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="hover:bg-gray-900/50 cursor-pointer transition-colors"
            >
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-gray-200">{job.name}</span>
              </td>
              <td className="py-3 px-4">
                <JobStatusBadge status={job.status} />
              </td>
              {showTemplate && (
                <td className="py-3 px-4">
                  <span className="text-sm text-gray-400">
                    {job.template?.name || 'Custom'}
                  </span>
                </td>
              )}
              <td className="py-3 px-4">
                <span className="text-sm text-gray-400">
                  {new Date(job.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-400">
                  {job.executionTime ? `${(job.executionTime / 1000).toFixed(1)}s` : '-'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
