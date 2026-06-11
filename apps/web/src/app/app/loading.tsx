export default function AppLoading() {
  return (
    <div className="app-page-scroll">
      <div className="max-w-4xl mx-auto w-full py-4 animate-pulse">
        <div className="h-7 bg-surface-muted rounded-lg w-48 mb-2" />
        <div className="h-4 bg-surface-muted rounded w-80 mb-8" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 bg-surface-muted rounded-lg mb-2" />
        ))}
      </div>
    </div>
  )
}
