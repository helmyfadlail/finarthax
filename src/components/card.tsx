import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "elevated";
}

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-white dark:bg-primary-200 rounded-xl shadow-sm border border-primary-100 dark:border-primary-400",
    bordered: "bg-white dark:bg-primary-200 rounded-xl border-2 border-primary-200 dark:border-primary-400",
    elevated: "bg-white dark:bg-primary-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow",
  };
  return <div ref={ref} className={cn(variants[variant], className)} {...props} />;
});
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("p-4 pb-3 xl:p-6 xl:pb-4", className)} {...props} />);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("font-bold text-primary-900 dark:text-primary-900 text-lg md:text-xl lg:text-2xl", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-primary-500 dark:text-primary-700 mt-1 text-xs md:text-sm", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 pb-4 pt-0 xl:px-6 xl:pb-6", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 pb-4 pt-0 flex items-center gap-2 xl:px-6 xl:pb-6 xl:gap-3", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
