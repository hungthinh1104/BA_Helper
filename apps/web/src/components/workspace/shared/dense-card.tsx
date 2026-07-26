import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const denseCardVariants = cva(
  "flex flex-col overflow-hidden rounded-lg border",
  {
    variants: {
      variant: {
        default: "border-border/40 bg-surface",
        muted: "border-border/60 bg-surface-muted/30",
        soft: "border-border bg-surface-soft/30",
        dashed: "border-dashed border-border/60 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface DenseCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof denseCardVariants> {}

const DenseCard = React.forwardRef<HTMLDivElement, DenseCardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(denseCardVariants({ variant }), className)}
      {...props}
    />
  )
)
DenseCard.displayName = "DenseCard"

const DenseCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 sm:p-5", className)}
    {...props}
  />
))
DenseCardHeader.displayName = "DenseCardHeader"

const DenseCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-[13px] font-semibold leading-snug text-foreground", className)}
    {...props}
  />
))
DenseCardTitle.displayName = "DenseCardTitle"

const DenseCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[12px] leading-relaxed text-muted-foreground", className)}
    {...props}
  />
))
DenseCardDescription.displayName = "DenseCardDescription"

const DenseCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 sm:p-5 pt-0", className)} {...props} />
))
DenseCardContent.displayName = "DenseCardContent"

const denseAlertVariants = cva(
  "flex border rounded-lg p-4",
  {
    variants: {
      variant: {
        default: "bg-surface-muted border-border text-foreground",
        primary: "bg-primary/10 border-primary/20 text-primary",
        success: "bg-success/8 border-success/25 text-success",
        warning: "bg-warning/8 border-warning/25 text-warning",
        danger: "bg-danger/8 border-danger/25 text-danger",
        info: "bg-info/8 border-info/25 text-info",
      },
      layout: {
        row: "items-start gap-3",
        col: "flex-col gap-3",
      }
    },
    defaultVariants: {
      variant: "default",
      layout: "row",
    },
  }
)

export interface DenseAlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof denseAlertVariants> {}

const DenseAlert = React.forwardRef<HTMLDivElement, DenseAlertProps>(
  ({ className, variant, layout, role, ...props }, ref) => {
    const alertRole =
      role ?? (variant === "danger" || variant === "warning" ? "alert" : "status")

    return (
      <div
        ref={ref}
        role={alertRole}
        className={cn(denseAlertVariants({ variant, layout }), className)}
        {...props}
      />
    )
  }
)
DenseAlert.displayName = "DenseAlert"

export {
  DenseCard,
  DenseCardHeader,
  DenseCardTitle,
  DenseCardDescription,
  DenseCardContent,
  DenseAlert,
}
