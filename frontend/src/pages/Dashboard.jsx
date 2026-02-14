import { useNavigate } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import StatsCards from '../components/StatsCards';
import JobList from '../components/JobList';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useJobs({ limit: 10 });

  const jobs = data?.jobs || [];

  const stats = {
    total: data?.pagination?.total || 0,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    running: jobs.filter((j) => j.status === 'processing' || j.status === 'queued').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Overview of your automation activity</p>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors"
        >
          New Chat
        </button>
      </div>

      <StatsCards stats={stats} />

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Recent Jobs</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500 mx-auto" />
          </div>
        ) : (
          <JobList jobs={jobs} />
        )}
      </div>
    </div>
  );
}
