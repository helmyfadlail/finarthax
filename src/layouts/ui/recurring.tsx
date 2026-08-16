"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { usePreferences, useRecurring } from "@/hooks";
import { useCurrency } from "@/providers";
import { Badge, Button, Card, CardContent, Input, Modal, Select, Skeleton, useToast } from "@/components";
import { RECURRENCE_ICONS, RECURRENCE_INTERVALS, RECURRENCE_STATUS_ICONS } from "@/static";
import type { DetectedPattern, RecurrenceInterval, RecurrenceStatus, ScheduledRecurrence, TransactionType } from "@/types";
import { formattedDateTime, toDateTimeInputValue } from "@/utils";

const TYPE_CONFIG: Record<TransactionType, { color: string; bg: string; icon: string; prefix: string; badge: "success" | "error" | "info" }> = {
  INCOME: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: "💰", prefix: "+", badge: "success" },
  EXPENSE: { color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30", icon: "💳", prefix: "-", badge: "error" },
  TRANSFER: { color: "text-secondary-400 dark:text-secondary-400", bg: "bg-secondary-100 dark:bg-secondary-900/20", icon: "🔄", prefix: "⇄", badge: "info" },
};

const STATUS_BADGE: Record<RecurrenceStatus, "error" | "warning" | "default"> = {
  OVERDUE: "error",
  DUE_TODAY: "warning",
  UPCOMING: "default",
};

interface TrackTarget {
  transactionId: string;
  label: string;
  interval: RecurrenceInterval;
}
interface LogTarget {
  transactionId: string;
  label: string;
  amount: number;
  date: string;
  interval: RecurrenceInterval;
  isTracked: boolean;
}

const SummaryTile: React.FC<{ icon: string; label: string; value: string; hint?: string; accent: string }> = ({ icon, label, value, hint, accent }) => (
  <Card className="dark:bg-primary-200 dark:border-primary-400">
    <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
      <div className="flex items-center gap-1.5 mb-1 sm:gap-2">
        <span className="text-base sm:text-lg">{icon}</span>
        <span className="text-xs font-medium tracking-wide uppercase truncate text-primary-500 dark:text-primary-700">{label}</span>
      </div>
      <p className={`text-lg sm:text-xl lg:text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs truncate text-primary-400 dark:text-primary-600">{hint}</p>}
    </CardContent>
  </Card>
);

const SectionShell: React.FC<{ icon: string; title: string; description: string; count?: number; children: React.ReactNode }> = ({ icon, title, description, count, children }) => (
  <Card className="dark:bg-primary-200 dark:border-primary-400">
    <CardContent className="pt-4 sm:pt-6">
      <div className="mb-3 sm:mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base lg:text-lg text-primary-900 dark:text-primary-900">
          <span>{icon}</span>
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="default" className="text-xs">
              {count}
            </Badge>
          )}
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{description}</p>
      </div>
      {children}
    </CardContent>
  </Card>
);

const InlineEmpty: React.FC<{ icon: string; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="py-6 text-center sm:py-8">
    <div className="mb-2 text-3xl sm:text-4xl">{icon}</div>
    <h3 className="mb-1 text-sm font-bold sm:text-base text-primary-900 dark:text-primary-900">{title}</h3>
    <p className="max-w-sm mx-auto text-xs sm:text-sm text-primary-500 dark:text-primary-700">{description}</p>
  </div>
);

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 sm:space-y-6">
    <Skeleton className="w-48 h-7 sm:w-72 sm:h-8" />
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 sm:h-24" />
      ))}
    </div>
    {[1, 2].map((i) => (
      <Skeleton key={i} className="h-48 sm:h-56" />
    ))}
  </div>
);

const ScheduleRow: React.FC<{
  item: ScheduledRecurrence;
  dateFormat: string;
  isBusy: boolean;
  onLog: (item: ScheduledRecurrence) => void;
  onSkip: (item: ScheduledRecurrence) => void;
  onStop: (item: ScheduledRecurrence) => void;
}> = ({ item, dateFormat, isBusy, onLog, onSkip, onStop }) => {
  const t = useTranslations("recurringPage");
  const { format } = useCurrency();
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.EXPENSE;

  const timing =
    item.status === "OVERDUE" ? t("relative.overdue", { days: Math.abs(item.daysUntil) }) : item.status === "DUE_TODAY" ? t("relative.today") : t("relative.inDays", { days: item.daysUntil });

  return (
    <div className="p-3 transition-all rounded-lg sm:p-4 bg-primary-50 hover:bg-primary-100 hover:shadow-md dark:bg-primary-200 dark:hover:bg-primary-300">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex items-start flex-1 min-w-0 gap-2 sm:gap-3">
          <div className={`flex items-center justify-center shrink-0 w-9 h-9 text-lg sm:w-11 sm:h-11 sm:text-xl rounded-full ${config.bg}`}>{item.category?.icon ?? config.icon}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate sm:text-base text-primary-900 dark:text-primary-900" title={item.description ?? ""}>
              {item.description || t("noDescription")}
            </h4>
            <div className="flex flex-wrap items-center gap-1 mt-1 text-xs sm:gap-2 sm:text-sm text-primary-500 dark:text-primary-700">
              <span>
                {RECURRENCE_ICONS[item.interval]} {t(`interval.${item.interval}`)}
              </span>
              <span>•</span>
              <span className="truncate">
                {item.account.icon} {item.account.name}
                {item.toAccount ? ` → ${item.toAccount.name}` : ""}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">{t("meta.occurrences", { count: item.occurrences })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 sm:gap-2">
              <Badge variant={STATUS_BADGE[item.status]} className="text-xs">
                {RECURRENCE_STATUS_ICONS[item.status]} {timing}
              </Badge>
              <span className="text-xs text-primary-400 dark:text-primary-600">
                {t("meta.next")}: {formattedDateTime(item.nextOccurrence, dateFormat)}
              </span>
              {item.recurrenceEndDate && <span className="text-xs text-primary-400 dark:text-primary-600">• {t("meta.endsOn", { date: formattedDateTime(item.recurrenceEndDate, dateFormat) })}</span>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm sm:text-lg font-bold tabular-nums ${config.color}`}>
            {config.prefix} {format(item.amount)}
          </p>
          <p className="mt-0.5 text-xs text-primary-400 dark:text-primary-600">{t("meta.perMonth", { amount: format(item.monthlyEstimate) })}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-1.5 pt-3 mt-3 border-t sm:gap-2 border-primary-100 dark:border-primary-400">
        <Button variant="ghost" size="sm" onClick={() => onStop(item)} disabled={isBusy} className="text-xs">
          🚫 {t("actions.stop")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSkip(item)} disabled={isBusy} className="text-xs">
          ⏭️ {t("actions.skip")}
        </Button>
        <Button variant="primary" size="sm" onClick={() => onLog(item)} disabled={isBusy} className="text-xs">
          ✅ {t("actions.log")}
        </Button>
      </div>
    </div>
  );
};

const SuggestionRow: React.FC<{
  pattern: DetectedPattern;
  dateFormat: string;
  isBusy: boolean;
  onTrack: (pattern: DetectedPattern) => void;
  onLog: (pattern: DetectedPattern) => void;
  onDismiss: (pattern: DetectedPattern) => void;
}> = ({ pattern, dateFormat, isBusy, onTrack, onLog, onDismiss }) => {
  const t = useTranslations("recurringPage");
  const { format } = useCurrency();
  const config = TYPE_CONFIG[pattern.type] ?? TYPE_CONFIG.EXPENSE;

  return (
    <div className="p-3 transition-all border rounded-lg sm:p-4 border-secondary-100 dark:border-secondary-800/30 bg-secondary-50/60 dark:bg-secondary-900/10 hover:shadow-md">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex items-start flex-1 min-w-0 gap-2 sm:gap-3">
          <div className={`flex items-center justify-center shrink-0 w-9 h-9 text-lg sm:w-11 sm:h-11 sm:text-xl rounded-full ${config.bg}`}>{config.icon}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate sm:text-base text-primary-900 dark:text-primary-900" title={pattern.description ?? ""}>
              {pattern.description || t("noDescription")}
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-primary-600 dark:text-primary-700">
              {t("detectedSummary", {
                count: pattern.occurrences,
                interval: t(`interval.${pattern.interval}`).toLowerCase(),
                amount: format(pattern.averageAmount),
              })}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 sm:gap-2">
              <Badge variant="info" className="text-xs">
                {RECURRENCE_ICONS[pattern.interval]} {t("meta.confidence", { value: pattern.confidence })}
              </Badge>
              <span className="text-xs text-primary-400 dark:text-primary-600">
                {t("meta.last")}: {formattedDateTime(pattern.lastDate, dateFormat)} • {t("meta.next")}: {formattedDateTime(pattern.nextDate, dateFormat)}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm sm:text-lg font-bold tabular-nums ${config.color}`}>
            {config.prefix} {format(pattern.averageAmount)}
          </p>
          <p className="mt-0.5 text-xs text-primary-400 dark:text-primary-600">{t("meta.perMonth", { amount: format(pattern.monthlyEstimate) })}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-1.5 pt-3 mt-3 border-t sm:gap-2 border-secondary-100 dark:border-secondary-800/30">
        <Button variant="ghost" size="sm" onClick={() => onDismiss(pattern)} disabled={isBusy} className="text-xs">
          🙈 {t("actions.dismiss")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onLog(pattern)} disabled={isBusy} className="text-xs">
          ✅ {t("actions.log")}
        </Button>
        <Button variant="primary" size="sm" onClick={() => onTrack(pattern)} disabled={isBusy} className="text-xs">
          🔁 {t("actions.track")}
        </Button>
      </div>
    </div>
  );
};

/**
 * Logging an occurrence asks the same two questions wherever it is triggered from - the full
 * recurring view and the due panel on the transactions list both mount this, so the fields and the
 * validation cannot drift apart. The mutation stays with the caller: each one reports success
 * differently.
 */
const LogOccurrenceForm: React.FC<{
  target: LogTarget;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number, date: string) => void;
}> = ({ target, isSubmitting, onClose, onSubmit }) => {
  const t = useTranslations("recurringPage");
  const { addToast } = useToast();
  // Seeded once, on mount. The modal below mounts this per target and unmounts it on close, so an
  // amount edited for one row can never be inherited by the next.
  const [form, setForm] = React.useState<{ amount: string; date: string }>(() => ({ amount: String(target.amount), date: toDateTimeInputValue(target.date) }));

  const handleSubmit = React.useCallback(() => {
    const amount = parseFloat(form.amount);
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      addToast({ message: t("validation.amount"), type: "error" });
      return;
    }
    if (!form.date) {
      addToast({ message: t("validation.date"), type: "error" });
      return;
    }
    onSubmit(amount, new Date(form.date).toISOString());
  }, [form, onSubmit, addToast, t]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="p-2.5 sm:p-3 rounded-lg border bg-primary-50 dark:bg-primary-300 border-primary-100 dark:border-primary-400">
        <p className="text-xs font-medium sm:text-sm text-primary-700 dark:text-primary-800">💡 {t("logModal.hint", { name: target.label || t("noDescription") })}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Input
          type="number"
          label={`${t("logModal.amount")} *`}
          value={form.amount}
          onChange={(e) => setForm((previous) => ({ ...previous, amount: e.target.value }))}
          icon={<span className="text-primary-500 dark:text-primary-700">Rp</span>}
          min="1"
          step="1000"
          required
        />
        <Input type="datetime-local" label={`${t("logModal.date")} *`} value={form.date} onChange={(e) => setForm((previous) => ({ ...previous, date: e.target.value }))} required />
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-primary-100 dark:border-primary-400 sm:gap-3 sm:pt-4">
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="text-xs sm:text-sm">
          {t("logModal.cancel")}
        </Button>
        <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting} className="text-xs sm:text-sm">
          {t("logModal.submit")}
        </Button>
      </div>
    </div>
  );
};

const LogOccurrenceModal: React.FC<{
  target: LogTarget | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number, date: string) => void;
}> = ({ target, isSubmitting, onClose, onSubmit }) => {
  const t = useTranslations("recurringPage");

  return (
    <Modal isOpen={!!target} onClose={onClose} title={`✅ ${t("logModal.title")}`} size="md">
      {target && <LogOccurrenceForm key={target.transactionId} target={target} isSubmitting={isSubmitting} onClose={onClose} onSubmit={onSubmit} />}
    </Modal>
  );
};

/** How many due rows the panel shows before it stops and points at the full view. */
const DUE_PANEL_LIMIT = 3;

/**
 * The one thing someone opens the recurring view for on most days is confirming or skipping what is
 * due, so that much is surfaced on the transactions list itself. Everything else - detection,
 * upcoming, dismissed - stays on the Recurring tab, which is the only place with room for it.
 */
export const RecurringDuePanel: React.FC<{ onViewAll: () => void }> = ({ onViewAll }) => {
  const t = useTranslations("recurringPage");
  const { format } = useCurrency();
  const { addToast } = useToast();
  const { preferences } = usePreferences();

  // Same filter as the tab beside it, so TanStack serves both from one cache entry.
  const { due, confirmRecurring, isConfirming, skipRecurring, isSkipping } = useRecurring({ lookaheadDays: preferences.recurringLookaheadDays });

  const [logTarget, setLogTarget] = React.useState<LogTarget | null>(null);
  const [isHidden, setIsHidden] = React.useState(false);

  const notify = React.useCallback(
    (successKey: string, errorKey: string, onDone?: () => void, silenceable = false) => ({
      onSuccess: () => {
        if (!silenceable || preferences.transactionAlerts) addToast({ message: t(successKey), type: "success" });
        onDone?.();
      },
      onError: (error: Error) => addToast({ message: error.message || t(errorKey), type: "error" }),
    }),
    [addToast, t, preferences.transactionAlerts],
  );

  const handleLogSubmit = React.useCallback(
    (amount: number, date: string) => {
      if (!logTarget) return;
      confirmRecurring({ id: logTarget.transactionId, data: { amount, date } }, notify("success.logged", "error.log", () => setLogTarget(null), true));
    },
    [logTarget, confirmRecurring, notify],
  );

  // Everything here is already tracked - the panel only ever renders `due`, which is the scheduled
  // side of the overview - so `interval` never has to be re-sent on confirm.
  const openLog = React.useCallback(
    (item: ScheduledRecurrence) => setLogTarget({ transactionId: item.transactionId, label: item.description ?? "", amount: item.amount, date: item.nextOccurrence, interval: item.interval, isTracked: true }),
    [],
  );

  if (!preferences.recurringReminders || due.length === 0 || isHidden) return null;

  const isBusy = isConfirming || isSkipping;
  const overflow = due.length - DUE_PANEL_LIMIT;

  return (
    <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20">
      <CardContent className="pt-4 sm:pt-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base text-amber-900 dark:text-amber-300">
              🔔 {t("duePanel.title")}
              <Badge variant="warning" className="text-xs">
                {due.length}
              </Badge>
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-amber-700 dark:text-amber-400">{t("duePanel.description")}</p>
          </div>
          <button
            onClick={() => setIsHidden(true)}
            aria-label={t("duePanel.hide")}
            title={t("duePanel.hide")}
            className="px-1 text-sm transition-colors shrink-0 text-amber-700/70 hover:text-amber-900 dark:text-amber-400/70 dark:hover:text-amber-300"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {due.slice(0, DUE_PANEL_LIMIT).map((item) => {
            const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.EXPENSE;
            const timing = item.status === "OVERDUE" ? t("relative.overdue", { days: Math.abs(item.daysUntil) }) : t("relative.today");

            return (
              <div key={item.transactionId} className="flex flex-wrap items-center gap-2 p-2.5 bg-white rounded-lg sm:p-3 sm:gap-3 dark:bg-primary-200">
                <div className={`flex items-center justify-center shrink-0 w-8 h-8 text-base sm:w-9 sm:h-9 sm:text-lg rounded-full ${config.bg}`}>{item.category?.icon ?? config.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-primary-900 dark:text-primary-900" title={item.description ?? ""}>
                    {item.description || t("noDescription")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant={STATUS_BADGE[item.status]} className="text-xs">
                      {RECURRENCE_STATUS_ICONS[item.status]} {timing}
                    </Badge>
                    <span className="text-xs truncate text-primary-400 dark:text-primary-600">
                      {item.account.icon} {item.account.name}
                    </span>
                  </div>
                </div>
                <p className={`text-sm font-bold tabular-nums shrink-0 sm:text-base ${config.color}`}>
                  {config.prefix} {format(item.amount)}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => skipRecurring(item.transactionId, notify("success.skipped", "error.skip"))} disabled={isBusy} className="text-xs">
                    ⏭️ {t("actions.skip")}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => openLog(item)} disabled={isBusy} className="text-xs">
                    ✅ {t("actions.log")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 mt-2 border-t border-amber-200/70 dark:border-amber-900/40">
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs text-amber-800 dark:text-amber-300">
            {overflow > 0 ? t("duePanel.more", { count: overflow }) : t("duePanel.viewAll")} →
          </Button>
        </div>
      </CardContent>

      <LogOccurrenceModal target={logTarget} isSubmitting={isConfirming} onClose={() => setLogTarget(null)} onSubmit={handleLogSubmit} />
    </Card>
  );
};

export const Recurring: React.FC = () => {
  const t = useTranslations("recurringPage");
  const { format } = useCurrency();
  const { addToast } = useToast();

  const { preferences } = usePreferences();

  const {
    summary,
    due,
    upcoming,
    detected,
    dismissed,
    isLoading,
    trackRecurring,
    isTracking,
    confirmRecurring,
    isConfirming,
    skipRecurring,
    isSkipping,
    dismissRecurring,
    isDismissing,
    restoreRecurring,
    isRestoring,
  } = useRecurring({ lookaheadDays: preferences.recurringLookaheadDays });

  const isBusy = isTracking || isConfirming || isSkipping || isDismissing || isRestoring;

  const [trackTarget, setTrackTarget] = React.useState<TrackTarget | null>(null);
  const [logTarget, setLogTarget] = React.useState<LogTarget | null>(null);
  const [stopTarget, setStopTarget] = React.useState<ScheduledRecurrence | null>(null);
  const [showDismissed, setShowDismissed] = React.useState(false);

  const [trackForm, setTrackForm] = React.useState<{ interval: RecurrenceInterval; endDate: string }>({ interval: "MONTHLY", endDate: "" });

  const intervalOptions = React.useMemo(() => RECURRENCE_INTERVALS.map((interval) => ({ value: interval, label: `${RECURRENCE_ICONS[interval]} ${t(`interval.${interval}`)}` })), [t]);

  const notify = React.useCallback(
    (successKey: string, errorKey: string, onDone?: () => void, silenceable = false) => ({
      onSuccess: () => {
        if (!silenceable || preferences.transactionAlerts) addToast({ message: t(successKey), type: "success" });
        onDone?.();
      },
      onError: (error: Error) => addToast({ message: error.message || t(errorKey), type: "error" }),
    }),
    [addToast, t, preferences.transactionAlerts],
  );

  const openTrackModal = React.useCallback((pattern: DetectedPattern) => {
    setTrackForm({ interval: pattern.interval, endDate: "" });
    setTrackTarget({ transactionId: pattern.transactionId, label: pattern.description ?? "", interval: pattern.interval });
  }, []);

  const openLogModal = React.useCallback((target: LogTarget) => setLogTarget(target), []);

  const handleTrackSubmit = React.useCallback(() => {
    if (!trackTarget) return;
    trackRecurring(
      { id: trackTarget.transactionId, data: { isRecurring: true, interval: trackForm.interval, endDate: trackForm.endDate ? new Date(trackForm.endDate).toISOString() : null } },
      notify("success.tracked", "error.track", () => setTrackTarget(null)),
    );
  }, [trackTarget, trackForm, trackRecurring, notify]);

  const handleLogSubmit = React.useCallback(
    (amount: number, date: string) => {
      if (!logTarget) return;
      confirmRecurring(
        {
          id: logTarget.transactionId,
          // A detected pattern is not tracked yet, so confirming it has to say how often it repeats.
          data: { amount, date, ...(logTarget.isTracked ? {} : { interval: logTarget.interval }) },
        },
        notify("success.logged", "error.log", () => setLogTarget(null), true),
      );
    },
    [logTarget, confirmRecurring, notify],
  );

  const handleStopConfirm = React.useCallback(() => {
    if (!stopTarget) return;
    trackRecurring(
      { id: stopTarget.transactionId, data: { isRecurring: false } },
      notify("success.stopped", "error.stop", () => setStopTarget(null)),
    );
  }, [stopTarget, trackRecurring, notify]);

  const handleSkip = React.useCallback((item: ScheduledRecurrence) => skipRecurring(item.transactionId, notify("success.skipped", "error.skip")), [skipRecurring, notify]);
  const handleDismiss = React.useCallback((pattern: DetectedPattern) => dismissRecurring(pattern.transactionId, notify("success.dismissed", "error.dismiss")), [dismissRecurring, notify]);
  const handleRestore = React.useCallback((pattern: DetectedPattern) => restoreRecurring(pattern.transactionId, notify("success.restored", "error.restore")), [restoreRecurring, notify]);

  const logFromSchedule = React.useCallback(
    (item: ScheduledRecurrence) =>
      openLogModal({ transactionId: item.transactionId, label: item.description ?? "", amount: item.amount, date: item.nextOccurrence, interval: item.interval, isTracked: true }),
    [openLogModal],
  );

  const logFromPattern = React.useCallback(
    (pattern: DetectedPattern) =>
      openLogModal({ transactionId: pattern.transactionId, label: pattern.description ?? "", amount: pattern.averageAmount, date: pattern.nextDate, interval: pattern.interval, isTracked: false }),
    [openLogModal],
  );

  if (isLoading) return <LoadingSkeleton />;

  const hasNothingAtAll = summary.trackedCount === 0 && detected.length === 0 && dismissed.length === 0;

  return (
    // The title, the tab bar and the way back all belong to the workspace this renders inside of.
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <SummaryTile icon="🔔" label={t("summary.due")} value={String(summary.dueCount)} hint={t("summary.dueHint")} accent="text-rose-600 dark:text-rose-400" />
        <SummaryTile
          icon="📅"
          label={t("summary.upcoming")}
          value={String(summary.upcomingCount)}
          hint={t("summary.upcomingHint", { days: preferences.recurringLookaheadDays })}
          accent="text-primary-900 dark:text-primary-900"
        />
        <SummaryTile icon="🔍" label={t("summary.detected")} value={String(summary.detectedCount)} hint={t("summary.detectedHint")} accent="text-secondary-500 dark:text-secondary-400" />
        <SummaryTile icon="💸" label={t("summary.committed")} value={format(summary.monthlyCommitted)} hint={t("summary.committedHint")} accent="text-primary-900 dark:text-primary-900" />
      </div>

      {hasNothingAtAll ? (
        <Card className="dark:bg-primary-200 dark:border-primary-400">
          <CardContent className="pt-4 sm:pt-6">
            <InlineEmpty icon="🔁" title={t("empty.all.title")} description={t("empty.all.description")} />
          </CardContent>
        </Card>
      ) : (
        <>
          <SectionShell icon="🔔" title={t("sections.due.title")} description={t("sections.due.description")} count={due.length}>
            {due.length === 0 ? (
              <InlineEmpty icon="✨" title={t("empty.due.title")} description={t("empty.due.description")} />
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {due.map((item) => (
                  <ScheduleRow key={item.transactionId} item={item} dateFormat={preferences.dateFormat} isBusy={isBusy} onLog={logFromSchedule} onSkip={handleSkip} onStop={setStopTarget} />
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell icon="🔍" title={t("sections.detected.title")} description={t("sections.detected.description")} count={detected.length}>
            {detected.length === 0 ? (
              <InlineEmpty icon="🕵️" title={t("empty.detected.title")} description={t("empty.detected.description")} />
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {detected.map((pattern) => (
                  <SuggestionRow
                    key={pattern.patternKey}
                    pattern={pattern}
                    dateFormat={preferences.dateFormat}
                    isBusy={isBusy}
                    onTrack={openTrackModal}
                    onLog={logFromPattern}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell icon="📅" title={t("sections.upcoming.title")} description={t("sections.upcoming.description", { days: preferences.recurringLookaheadDays })} count={upcoming.length}>
            {upcoming.length === 0 ? (
              <InlineEmpty icon="🗓️" title={t("empty.upcoming.title")} description={t("empty.upcoming.description")} />
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {upcoming.map((item) => (
                  <ScheduleRow key={item.transactionId} item={item} dateFormat={preferences.dateFormat} isBusy={isBusy} onLog={logFromSchedule} onSkip={handleSkip} onStop={setStopTarget} />
                ))}
              </div>
            )}
          </SectionShell>

          {dismissed.length > 0 && (
            <Card className="dark:bg-primary-200 dark:border-primary-400">
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold sm:text-base text-primary-900 dark:text-primary-900">
                      🙈 {t("sections.dismissed.title")} ({dismissed.length})
                    </h2>
                    <p className="mt-0.5 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("sections.dismissed.description")}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowDismissed((previous) => !previous)} className="text-xs shrink-0">
                    {showDismissed ? t("sections.dismissed.hide") : t("sections.dismissed.show")}
                  </Button>
                </div>
                {showDismissed && (
                  <div className="mt-3 space-y-2 sm:mt-4">
                    {dismissed.map((pattern) => (
                      <div key={pattern.patternKey} className="flex items-center justify-between gap-2 p-2.5 rounded-lg sm:p-3 bg-primary-50 dark:bg-primary-300">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-primary-900 dark:text-primary-900">{pattern.description || t("noDescription")}</p>
                          <p className="text-xs truncate text-primary-500 dark:text-primary-700">
                            {t(`interval.${pattern.interval}`)} • {format(pattern.averageAmount)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleRestore(pattern)} disabled={isBusy} className="text-xs shrink-0">
                          ↩️ {t("actions.restore")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Modal isOpen={!!trackTarget} onClose={() => setTrackTarget(null)} title={`🔁 ${t("trackModal.title")}`} size="md">
        <div className="space-y-3 sm:space-y-4">
          <div className="p-2.5 sm:p-3 rounded-lg border bg-primary-50 dark:bg-primary-300 border-primary-100 dark:border-primary-400">
            <p className="text-xs font-medium sm:text-sm text-primary-700 dark:text-primary-800">💡 {t("trackModal.hint", { name: trackTarget?.label || t("noDescription") })}</p>
          </div>
          <Select
            label={`${t("trackModal.interval")} *`}
            options={intervalOptions}
            value={trackForm.interval}
            onChange={(e) => setTrackForm((previous) => ({ ...previous, interval: e.target.value as RecurrenceInterval }))}
          />
          <Input type="datetime-local" label={t("trackModal.endDate")} value={trackForm.endDate} onChange={(e) => setTrackForm((previous) => ({ ...previous, endDate: e.target.value }))} />
          <p className="text-xs text-primary-500 dark:text-primary-700">{t("trackModal.endDateHint")}</p>
          <div className="flex justify-end gap-2 pt-3 border-t border-primary-100 dark:border-primary-400 sm:gap-3 sm:pt-4">
            <Button variant="ghost" onClick={() => setTrackTarget(null)} disabled={isTracking} className="text-xs sm:text-sm">
              {t("trackModal.cancel")}
            </Button>
            <Button variant="primary" onClick={handleTrackSubmit} isLoading={isTracking} className="text-xs sm:text-sm">
              {t("trackModal.submit")}
            </Button>
          </div>
        </div>
      </Modal>

      <LogOccurrenceModal target={logTarget} isSubmitting={isConfirming} onClose={() => setLogTarget(null)} onSubmit={handleLogSubmit} />

      <Modal isOpen={!!stopTarget} onClose={() => setStopTarget(null)} title={t("stopModal.title")} size="sm">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-start gap-2.5 p-3 border rounded-lg sm:gap-3 sm:p-4 border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20">
            <span className="text-xl sm:text-2xl shrink-0">⚠️</span>
            <div>
              <p className="mb-0.5 text-sm font-medium sm:mb-1 text-amber-900 dark:text-amber-300">{t("stopModal.confirm")}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 sm:text-sm">{t("stopModal.warning")}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setStopTarget(null)} disabled={isTracking} className="text-xs sm:text-sm">
              {t("stopModal.cancel")}
            </Button>
            <Button variant="danger" onClick={handleStopConfirm} isLoading={isTracking} className="text-xs sm:text-sm">
              {t("stopModal.submit")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
