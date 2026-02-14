const statusConfig = {
  queued: { label: 'Queued', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  processing: { label: 'Processing', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  completed: { label: 'Completed', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  canceled: { label: 'Canceled', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

export default function JobStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.queued;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      {status === 'processing' && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
