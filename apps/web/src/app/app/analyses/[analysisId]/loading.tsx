export default function AnalysisLoading() {
  return (
    <div className="app-content animate-pulse">
      {/* Sticky header skeleton */}
      <div className="analysis-sticky-header">
        <div className="h-7 bg-surface-muted rounded-lg w-64 mb-2" />
        <div className="h-4 bg-surface-muted rounded w-52 mb-4" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 bg-surface-muted rounded-md w-20" />
          ))}
        </div>
      </div>

      {/* Insight rows skeleton */}
      <div className="flex flex-col gap-3 max-w-4xl mt-4">
        <div className="h-4 bg-surface-muted rounded w-28 mb-1" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-surface-muted rounded-lg" />
        ))}
        <div className="h-4 bg-surface-muted rounded w-36 mt-4 mb-1" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-surface-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}
