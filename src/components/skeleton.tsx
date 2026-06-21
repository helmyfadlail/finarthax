import { HTMLAttributes } from "react";
import { cn } from "@/utils";

export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div className={cn("animate-pulse rounded-lg bg-primary-100 dark:bg-primary-300", className)} {...props} />;
