export default function UsageBar({ label, current, max, color = 'primary' }) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  const colorClasses = {
    primary: 'bg-primary-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-sm text-gray-300 font-medium">
          {current} / {max}
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color] || colorClasses.primary}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
