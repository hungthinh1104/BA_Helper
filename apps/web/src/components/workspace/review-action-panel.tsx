import { Button } from "@/components/ui/button"

interface ReviewActionPanelProps {
  status: "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED"
  onStatusChange: (status: "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED") => void
}

export function ReviewActionPanel({ status, onStatusChange }: ReviewActionPanelProps) {
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Review Action</h4>
      
      {status === "NEEDS_REVIEW" ? (
        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-success hover:bg-success/90 text-white" 
            onClick={() => onStatusChange("CONFIRMED")}
          >
            Confirm
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 text-danger hover:text-danger hover:bg-danger/10 border-danger/30"
            onClick={() => onStatusChange("REJECTED")}
          >
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-surface-muted p-3 rounded-lg border border-border">
          <span className={`text-sm font-semibold ${status === "CONFIRMED" ? "text-success" : "text-danger"}`}>
            {status === "CONFIRMED" ? "Confirmed" : "Rejected"}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => onStatusChange("NEEDS_REVIEW")}
          >
            Undo
          </Button>
        </div>
      )}
    </div>
  )
}
