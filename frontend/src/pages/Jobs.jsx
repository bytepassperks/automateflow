import { useState } from 'react';
import { useJobs } from '../hooks/useJobs';
import JobList from '../components/JobList';
import CreateJobModal from '../components/CreateJobModal';

export default function Jobs() {
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useJobs({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });

  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-gray-400 mt-1">Manage your automation jobs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors"
        >
          Create Job
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="canceled">Canceled</option>
        </select>
        <span className="text-sm text-gray-500">
          {pagination.total || 0} total jobs
        </span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500 mx-auto" />
          </div>
        ) : (
          <JobList jobs={data?.jobs || []} />
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page === pagination.totalPages}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <CreateJobModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
