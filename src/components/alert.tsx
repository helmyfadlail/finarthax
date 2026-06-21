import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/utils";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "default", icon, children, ...props }, ref) => {
  const variants = {
    default: "bg-primary-50 dark:bg-primary-300 border-primary-200 dark:border-primary-400 text-primary-900 dark:text-primary-900",
    success: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300",
    warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-300",
    error: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-300",
    info: "bg-secondary-50 dark:bg-secondary-900/10 border-secondary-100 dark:border-secondary-800/30 text-secondary-700 dark:text-secondary-400",
  };

  const iconColors = {
    default: "text-primary-500 dark:text-primary-700",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    error: "text-rose-600 dark:text-rose-400",
    info: "text-secondary-500 dark:text-secondary-400",
  };

  return (
    <div ref={ref} className={cn("relative w-full rounded-lg border flex items-start p-3 gap-2 md:p-4 md:gap-3 lg:p-5 lg:gap-4", variants[variant], className)} {...props}>
      {icon && <div className={cn("shrink-0", iconColors[variant])}>{icon}</div>}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("font-semibold text-sm mb-0.5 md:text-base md:mb-1", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("opacity-90 text-xs md:text-sm", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
