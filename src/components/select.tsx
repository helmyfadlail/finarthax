import { forwardRef, SelectHTMLAttributes } from "react";

import { cn } from "@/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  parentClassName?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ parentClassName, className, label, error, options, ...props }, ref) => {
  return (
    <div className={cn("w-full", parentClassName)}>
      {label && <label className="block text-xs font-medium text-primary-700 mb-1 md:text-sm md:mb-1.5">{label}</label>}
      <select
        ref={ref}
        className={cn(
          "w-full rounded-lg border-2 border-primary-100 bg-white text-primary-900",
          "focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none",
          "transition-all duration-200 cursor-pointer",
          "disabled:bg-neutral-100 disabled:cursor-not-allowed",
          "px-3 py-2 text-sm",
          "md:px-4 md:py-2.5 md:text-base",
          "lg:px-4 lg:py-3 lg:text-base",
          error && "border-red-500 focus:border-red-500 focus:ring-red-200",
          className,
        )}
        {...props}
      >
        {options.map((option, key) => (
          <option key={option.label + option.value + key} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500 md:mt-1.5 md:text-sm">{error}</p>}
    </div>
  );
});
Select.displayName = "Select";

export { Select };
