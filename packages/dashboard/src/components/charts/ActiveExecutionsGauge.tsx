interface Props {
  active: number;
  isLoading?: boolean;
}

export function ActiveExecutionsGauge({ active, isLoading }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div
        className={`w-28 h-28 rounded-full border-8 flex items-center justify-center transition-colors ${
          active === 0 ? 'border-gray-200' : active < 5 ? 'border-brand-400' : 'border-amber-400'
        }`}
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
        ) : (
          <span className="text-3xl font-bold text-gray-800">{active}</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">Active Executions</p>
    </div>
  );
}
