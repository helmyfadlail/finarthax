import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, label, error, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-xs font-medium text-primary-700 dark:text-primary-800 mb-1 md:text-sm md:mb-1.5">{label}</label>}
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border-2 transition-all duration-200 resize-none",
        "bg-white dark:bg-primary-300",
        "border-primary-100 dark:border-primary-400",
        "text-primary-900 dark:text-primary-900",
        "placeholder:text-primary-300 dark:placeholder:text-primary-600",
        "focus:border-primary-500 dark:focus:border-secondary-400",
        "focus:ring-2 focus:ring-primary-200 dark:focus:ring-secondary-400 focus:outline-none",
        "disabled:bg-primary-50 dark:disabled:bg-primary-200 disabled:cursor-not-allowed",
        // See input.tsx — never below 16px at mobile width or iOS Safari zooms the page in.
        "px-3 py-3 text-base md:px-4 md:py-2.5 lg:px-4 lg:py-3",
        error && "border-danger-500 focus:border-danger-500 focus:ring-danger-200",
        className,
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-danger-500 md:mt-1.5 md:text-sm">{error}</p>}
  </div>
));
Textarea.displayName = "Textarea";

export { Textarea };
