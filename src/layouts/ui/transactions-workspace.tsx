"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { usePreferences, useRecurring } from "@/hooks";
import { Badge } from "@/components";
import { Recurring, RecurringDuePanel } from "./recurring";
import { Transactions } from "./transactions";

/**
 * Transactions and its recurring schedule are two views of the same thing, so they share a screen
 * rather than two routes: switching tabs keeps the list in place and never costs a navigation.
 *
 * The active tab still lives in the URL (`?view=recurring`) rather than in component state. It is
 * what notification emails and the dashboard link to, and it survives a refresh - neither of which
 * a modal or a drawer could offer.
 */

const VIEW_PARAM = "view";
const RECURRING_VIEW = "recurring";

type View = "all" | typeof RECURRING_VIEW;

interface TabProps {
  isActive: boolean;
  label: string;
  icon: string;
  count?: number;
  onSelect: () => void;
}

const Tab: React.FC<TabProps> = ({ isActive, label, icon, count, onSelect }) => (
  <button
    type="button"
    role="tab"
    aria-selected={isActive}
    onClick={onSelect}
    className={`flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-3 sm:px-4 py-2 min-h-10 sm:min-h-0 text-sm font-medium rounded-md transition-all ${
      isActive
        ? "bg-white shadow-sm text-primary-900 dark:bg-primary-100 dark:text-primary-900"
        : "text-primary-500 hover:text-primary-900 dark:text-primary-700 dark:hover:text-primary-900"
    }`}
  >
    <span aria-hidden="true">{icon}</span>
    <span className="truncate">{label}</span>
    {count !== undefined && count > 0 && (
      <Badge variant="warning" className="text-xs">
        {count}
      </Badge>
    )}
  </button>
);

export const TransactionsWorkspace: React.FC = () => {
  const t = useTranslations("transactionsPage");
  const tRecurring = useTranslations("recurringPage");

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { preferences } = usePreferences();

  // Same filter the tab content uses, so the badge costs no extra request.
  const { due } = useRecurring({ lookaheadDays: preferences.recurringLookaheadDays });
  const dueCount = preferences.recurringReminders ? due.length : 0;

  const view: View = searchParams.get(VIEW_PARAM) === RECURRING_VIEW ? RECURRING_VIEW : "all";

  const selectView = React.useCallback(
    (next: View) => {
      // Every other param is a filter or a page number belonging to the list - carried across so
      // coming back from the recurring tab does not silently reset what was being looked at.
      const params = new URLSearchParams(searchParams.toString());
      if (next === RECURRING_VIEW) params.set(VIEW_PARAM, RECURRING_VIEW);
      else params.delete(VIEW_PARAM);

      const query = params.toString();
      // push, not replace: the browser back button should undo a tab switch, as it did when these
      // were two routes.
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, pathname, router],
  );

  const showRecurring = view === RECURRING_VIEW;

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900 dark:text-primary-900">{showRecurring ? tRecurring("title") : t("title")}</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{showRecurring ? tRecurring("subtitle") : t("subtitle")}</p>
      </div>

      <div role="tablist" aria-label={t("title")} className="inline-flex w-full gap-1 p-1 rounded-lg sm:w-auto bg-primary-100 dark:bg-primary-300">
        <Tab isActive={!showRecurring} label={t("tabs.all")} icon="🧾" onSelect={() => selectView("all")} />
        <Tab isActive={showRecurring} label={t("tabs.recurring")} icon="🔁" count={dueCount} onSelect={() => selectView(RECURRING_VIEW)} />
      </div>

      {showRecurring ? <Recurring /> : <RecurringDuePanel onViewAll={() => selectView(RECURRING_VIEW)} />}

      <div hidden={showRecurring}>
        {/*
          Kept mounted while the recurring tab is showing. The list owns its filters, its debounced
          search box and its page number, and remounting would throw all three away every time
          someone glanced at the schedule.
        */}
        <Transactions />
      </div>
    </div>
  );
};
