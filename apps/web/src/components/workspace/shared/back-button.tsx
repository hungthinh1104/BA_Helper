import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export function BackButton({ href, label = "Back", className }: BackButtonProps) {
  const router = useRouter()
  
  const finalClasses = cn("inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-fit mb-6", className);

  if (href) {
    return (
      <Link href={href} className={finalClasses}>
        <ChevronLeft className="w-4 h-4" /> {label}
      </Link>
    )
  }

  return (
    <button onClick={() => router.back()} className={finalClasses}>
      <ChevronLeft className="w-4 h-4" /> {label}
    </button>
  )
}
