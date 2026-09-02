"use client";

import { ReactNode, useEffect } from "react";
import { cn } from "@/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
}

export const Modal = ({ isOpen, onClose, title, description, children, size = "md", showCloseButton = true }: ModalProps) => {
  const sizes = {
    sm: "md:max-w-sm",
    md: "md:max-w-md",
    lg: "md:max-w-lg",
    xl: "md:max-w-xl",
    full: "md:max-w-full md:mx-4",
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="relative z-50">
      <div className={cn("fixed inset-0 bg-primary-900/60 backdrop-blur-sm transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0")} />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex items-end justify-center min-h-full md:items-center md:p-4" onClick={handleBackdropClick}>
          {/*
            * The sheet is a flex column with a hard height cap so a long form scrolls INSIDE
            * it. Without the cap the panel grew to its content height and the title and close
            * button were pushed off the top of the phone screen, leaving no visible way out of
            * a tall modal. `dvh` (not `vh`) so the cap follows mobile browser chrome as the
            * address bar collapses.
            */}
          <div
            className={cn(
              "w-full transform shadow-2xl transition-all duration-300 flex flex-col",
              "max-h-[92dvh] md:max-h-[85vh]",
              "rounded-t-2xl md:rounded-2xl",
              "bg-white dark:bg-primary-200",
              sizes[size],
              isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4 md:translate-y-0",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 pt-4 md:px-6 md:pt-6">
              <div className="w-10 h-1 mx-auto mb-3 rounded-full bg-primary-200 dark:bg-primary-400 md:hidden" />

              {(title || showCloseButton) && (
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div className="flex-1 min-w-0">
                    {title && <h2 className="text-base font-bold text-primary-900 dark:text-primary-900 md:text-xl">{title}</h2>}
                    {description && <p className="mt-0.5 text-xs text-primary-500 dark:text-primary-700 md:mt-1 md:text-sm">{description}</p>}
                  </div>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      aria-label="Close"
                      className="-mr-2 ml-2 p-2 shrink-0 rounded-lg transition-colors text-primary-400 dark:text-primary-600 hover:text-primary-600 dark:hover:text-primary-800 hover:bg-primary-50 dark:hover:bg-primary-300 md:ml-4"
                    >
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* `overscroll-contain` keeps a flick at the end of the form from scrolling the
              * page behind the sheet. The bottom padding clears the iOS home indicator. */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
