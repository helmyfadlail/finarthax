"use client";

import * as React from "react";

import { useTranslations } from "next-intl";

import { useGoals } from "@/hooks";

import { Card, CardContent, Button, Input, Modal, Badge, useToast, useCurrency } from "@/components";

import { calculateGoalStatus } from "@/utils";

import type { Goal } from "@/types";

interface FormData {
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
}

interface GoalCardProps {
  goal: Goal;
  onUpdateProgress: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, onUpdateProgress, onDelete }) => {
  const t = useTranslations("goalsPage");
  const { format } = useCurrency();

  const status = React.useMemo(() => calculateGoalStatus(goal), [goal]);

  const progressColor = React.useMemo(() => {
    if (status.isCompleted) return "bg-green-500";
    if (status.percentage >= 75) return "bg-blue-500";
    if (status.percentage >= 50) return "bg-yellow-500";
    return "bg-primary";
  }, [status]);

  const deadlineBadgeVariant = React.useMemo(() => {
    if (status.isOverdue) return "error" as const;
    if (status.isUrgent) return "warning" as const;
    return "info" as const;
  }, [status]);

  const deadlineText = React.useMemo(() => {
    if (!goal.deadline) return null;
    if (status.isOverdue) return t("overdue");
    if (status.daysLeft === 0) return t("dueToday");
    if (status.daysLeft === 1) return t("oneDayLeft");
    return t("daysLeft", { days: status.daysLeft as number });
  }, [goal.deadline, status, t]);

  const remainingAmount = React.useMemo(() => Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount)), [goal.targetAmount, goal.currentAmount]);

  return (
    <Card variant="elevated" className="transition-all duration-300 hover:shadow-xl">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="mb-1.5 text-base sm:text-xl font-bold truncate text-primary-900 sm:mb-2" title={goal.name}>
              {goal.name}
            </h3>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {goal.deadline && (
                <Badge variant={deadlineBadgeVariant} className="text-xs">
                  {status.isOverdue ? "⚠️" : "📅"} {deadlineText}
                </Badge>
              )}
              <Badge variant={status.isCompleted ? "success" : "default"} className="text-xs">
                {status.isCompleted ? `✓ ${t("completed")}` : `🎯 ${t("inProgress")}`}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mb-3 space-y-2 sm:mb-4 sm:space-y-3">
          <div>
            <p className="text-xl font-bold sm:text-3xl text-primary-900 tabular-nums">{format(Number(goal.currentAmount))}</p>
            <p className="mt-0.5 text-xs sm:mt-1 sm:text-sm text-primary-600">{t("ofTarget", { amount: format(Number(goal.targetAmount)) })}</p>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <div className="w-full h-3 overflow-hidden rounded-full shadow-inner sm:h-4 bg-primary-100" role="progressbar" aria-valuenow={status.percentage} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${Math.min(status.percentage, 100)}%` }} />
            </div>

            <div className="flex justify-between text-xs text-primary-600">
              <span className="font-medium">{t("achieved", { percentage: status.percentage.toFixed(1) })}</span>
              {!status.isCompleted && <span>{t("toGo", { amount: format(remainingAmount) })}</span>}
            </div>
          </div>
        </div>

        {status.isCompleted && (
          <div className="p-2.5 mb-3 border border-green-200 rounded-lg sm:p-3 sm:mb-4 bg-green-50">
            <p className="flex items-center gap-2 text-xs font-medium text-green-700 sm:text-sm">🎉 {t("congratulations")}</p>
          </div>
        )}

        {status.isOverdue && !status.isCompleted && (
          <div className="p-2.5 mb-3 border border-red-200 rounded-lg sm:p-3 sm:mb-4 bg-red-50">
            <p className="flex items-center gap-2 text-xs font-medium text-red-700 sm:text-sm">⚠️ {t("overdueWarning")}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" size="sm" className="flex-1 text-xs sm:text-sm" onClick={() => onUpdateProgress(goal)} disabled={status.isCompleted}>
            💰 {t("updateProgress")}
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(goal.id)} aria-label={t("deleteButton")} className="px-2 sm:px-3">
            🗑️
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState: React.FC<{ onCreateClick: () => void }> = ({ onCreateClick }) => {
  const t = useTranslations("goalsPage");
  return (
    <Card className="col-span-full">
      <CardContent className="pt-4 sm:pt-6">
        <div className="py-10 text-center sm:py-16">
          <div className="mb-3 text-4xl sm:mb-4 sm:text-6xl">🎯</div>
          <h3 className="mb-1.5 text-lg font-bold sm:mb-2 sm:text-xl text-primary-900">{t("empty.title")}</h3>
          <p className="max-w-xs mx-auto mb-5 text-sm sm:max-w-md sm:mb-6 text-primary-600">{t("empty.description")}</p>
          <Button variant="primary" onClick={onCreateClick} size="md" className="w-full sm:w-auto">
            + {t("empty.action")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const Goals: React.FC = () => {
  const t = useTranslations("goalsPage");
  const { goals, createGoal, isCreating, updateProgress, deleteGoal, isDeleting } = useGoals("ACTIVE");
  const { format } = useCurrency();
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = React.useState<boolean>(false);
  const [selectedGoal, setSelectedGoal] = React.useState<Goal | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [progressAmount, setProgressAmount] = React.useState<string>("");

  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    targetAmount: "",
    currentAmount: "",
    deadline: "",
  });

  const summary = React.useMemo(() => {
    const totalGoals = goals.length;
    const completedGoals = goals.filter((g) => (Number(g.currentAmount) / Number(g.targetAmount)) * 100 >= 100).length;
    const totalTarget = goals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.currentAmount), 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    return { totalGoals, completedGoals, totalTarget, totalSaved, overallProgress };
  }, [goals]);

  const resetForm = React.useCallback((): void => setFormData({ name: "", targetAmount: "", currentAmount: "", deadline: "" }), []);
  const openModal = React.useCallback((): void => {
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);
  const closeModal = React.useCallback((): void => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const handleCreate = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.targetAmount) {
        addToast({ message: t("validation.required"), type: "error" });
        return;
      }
      const targetAmount = parseFloat(formData.targetAmount);
      const currentAmount = parseFloat(formData.currentAmount || "0");
      if (targetAmount <= 0) {
        addToast({ message: t("validation.targetGreaterThanZero"), type: "error" });
        return;
      }
      if (currentAmount < 0) {
        addToast({ message: t("validation.currentNonNegative"), type: "error" });
        return;
      }
      if (currentAmount > targetAmount) {
        addToast({ message: t("validation.currentExceedsTarget"), type: "warning" });
      }
      createGoal(
        { ...formData, targetAmount, currentAmount, deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined },
        {
          onSuccess: () => {
            addToast({ message: t("success.created"), type: "success" });
            closeModal();
          },
          onError: (error: Error) => {
            addToast({ message: error.message || t("error.create"), type: "error" });
          },
        },
      );
    },
    [formData, createGoal, addToast, closeModal, t],
  );

  const handleOpenProgressModal = React.useCallback((goal: Goal): void => {
    setSelectedGoal(goal);
    setProgressAmount(goal.currentAmount.toString());
    setIsProgressModalOpen(true);
  }, []);
  const handleCloseProgressModal = React.useCallback((): void => {
    setIsProgressModalOpen(false);
    setSelectedGoal(null);
    setProgressAmount("");
  }, []);

  const handleUpdateProgress = React.useCallback((): void => {
    if (!selectedGoal || !progressAmount) {
      addToast({ message: t("validation.enterAmount"), type: "error" });
      return;
    }
    const amount = parseFloat(progressAmount);
    if (amount < 0) {
      addToast({ message: t("validation.amountNonNegative"), type: "error" });
      return;
    }
    if (amount > Number(selectedGoal.targetAmount)) {
      addToast({ message: t("validation.amountExceedsTarget"), type: "warning" });
    }
    updateProgress(
      { id: selectedGoal.id, currentAmount: amount },
      {
        onSuccess: () => {
          addToast({ message: amount >= Number(selectedGoal.targetAmount) ? t("success.goalCompleted") : t("success.progressUpdated"), type: "success" });
          handleCloseProgressModal();
        },
        onError: (error: Error) => {
          addToast({ message: error.message || t("error.updateProgress"), type: "error" });
        },
      },
    );
  }, [selectedGoal, progressAmount, updateProgress, addToast, handleCloseProgressModal, t]);

  const handleDeleteClick = React.useCallback((id: string): void => setDeleteId(id), []);
  const handleDeleteConfirm = React.useCallback((): void => {
    if (!deleteId) return;
    deleteGoal(deleteId, {
      onSuccess: () => {
        addToast({ message: t("success.deleted"), type: "success" });
        setDeleteId(null);
      },
      onError: (error: Error) => {
        addToast({ message: error.message || t("error.delete"), type: "error" });
      },
    });
  }, [deleteId, deleteGoal, addToast, t]);

  const handleFormChange = React.useCallback((field: keyof FormData, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <div className="space-y-3 sm:space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900">{t("title")}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-primary-600">{t("subtitle")}</p>
        </div>
        <Button variant="primary" size="lg" onClick={openModal} className="w-full sm:w-auto">
          + {t("addButton")}
        </Button>
      </div>

      {goals.length > 0 && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-xl font-bold sm:text-2xl tabular-nums text-primary-900">{summary.totalGoals}</p>
                <p className="mt-0.5 text-xs sm:mt-1 sm:text-sm text-primary-600">{t("summary.totalGoals")}</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-600 sm:text-2xl tabular-nums">{summary.completedGoals}</p>
                <p className="mt-0.5 text-xs sm:mt-1 sm:text-sm text-primary-600">{t("summary.completed")}</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold sm:text-2xl tabular-nums text-primary-900">{summary.overallProgress.toFixed(0)}%</p>
                <p className="mt-0.5 text-xs sm:mt-1 sm:text-sm text-primary-600">{t("summary.overallProgress")}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold sm:text-lg tabular-nums text-primary-900">{format(summary.totalSaved)}</p>
                <p className="mt-0.5 text-xs sm:mt-1 sm:text-sm text-primary-600">{t("summary.ofTotal", { amount: format(summary.totalTarget) })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
        {goals.length === 0 ? (
          <EmptyState onCreateClick={openModal} />
        ) : (
          goals.map((goal) => <GoalCard key={goal.id} goal={goal} onUpdateProgress={handleOpenProgressModal} onDelete={handleDeleteClick} />)
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={t("modal.createTitle")} size="md">
        <div className="space-y-3 sm:space-y-4">
          <div className="p-2.5 border rounded-lg sm:p-3 bg-primary-50 border-primary-200">
            <p className="text-xs font-medium sm:text-sm text-primary-700">💡 {t("modal.hint")}</p>
          </div>

          <Input
            type="text"
            label={`${t("modal.name")} *`}
            placeholder={t("modal.namePlaceholder")}
            value={formData.name}
            onChange={(e) => handleFormChange("name", e.target.value)}
            required
            maxLength={100}
          />

          <Input
            type="number"
            label={`${t("modal.targetAmount")} *`}
            placeholder={t("modal.targetAmountPlaceholder")}
            value={formData.targetAmount}
            onChange={(e) => handleFormChange("targetAmount", e.target.value)}
            icon={<span className="text-primary-600">Rp</span>}
            min="1"
            step="10000"
            required
          />

          <Input
            type="number"
            label={`${t("modal.currentAmount")} (${t("modal.optional")})`}
            placeholder={t("modal.currentAmountPlaceholder")}
            value={formData.currentAmount}
            onChange={(e) => handleFormChange("currentAmount", e.target.value)}
            icon={<span className="text-primary-600">Rp</span>}
            min="0"
            step="10000"
          />

          <Input
            type="date"
            label={`${t("modal.deadline")} (${t("modal.optional")})`}
            value={formData.deadline}
            onChange={(e) => handleFormChange("deadline", e.target.value)}
            min={new Date().toISOString().split("T")[0]}
          />

          <div className="flex justify-end gap-2 pt-3 border-t sm:gap-3 sm:pt-4">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={isCreating} className="text-xs sm:text-sm">
              {t("modal.cancel")}
            </Button>
            <Button onClick={handleCreate} variant="primary" isLoading={isCreating} className="text-xs sm:text-sm">
              {t("modal.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isProgressModalOpen} onClose={handleCloseProgressModal} title={t("progressModal.title")} size="md">
        <div className="space-y-3 sm:space-y-4">
          <div className="p-3 border rounded-lg sm:p-4 bg-primary-50 border-primary-200">
            <p className="mb-1 text-xs text-primary-600 sm:text-sm">{t("progressModal.updatingFor")}:</p>
            <p className="text-sm font-bold sm:text-base text-primary-900">{selectedGoal?.name}</p>
            <p className="mt-1.5 text-xs text-primary-600 sm:mt-2">
              {t("progressModal.currentInfo", {
                current: format(Number(selectedGoal?.currentAmount || 0)),
                target: format(Number(selectedGoal?.targetAmount || 0)),
              })}
            </p>
          </div>

          <Input
            type="number"
            label={`${t("progressModal.newAmount")} *`}
            placeholder={t("progressModal.newAmountPlaceholder")}
            value={progressAmount}
            onChange={(e) => setProgressAmount(e.target.value)}
            icon={<span className="text-primary-600">Rp</span>}
            min="0"
            step="10000"
            required
            autoFocus
          />

          {selectedGoal && progressAmount && (
            <div className="p-2.5 border border-blue-200 rounded-lg sm:p-3 bg-blue-50">
              <p className="text-xs text-blue-700 sm:text-sm">
                {parseFloat(progressAmount) >= Number(selectedGoal.targetAmount)
                  ? `🎉 ${t("progressModal.willComplete")}`
                  : t("progressModal.progressInfo", {
                      percentage: ((parseFloat(progressAmount) / Number(selectedGoal.targetAmount)) * 100).toFixed(1),
                    })}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t sm:gap-3 sm:pt-4">
            <Button variant="ghost" onClick={handleCloseProgressModal} className="text-xs sm:text-sm">
              {t("progressModal.cancel")}
            </Button>
            <Button variant="primary" onClick={handleUpdateProgress} className="text-xs sm:text-sm">
              {t("progressModal.update")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t("deleteModal.title")} size="sm">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-start gap-2.5 p-3 border border-red-200 rounded-lg sm:gap-3 sm:p-4 bg-red-50">
            <span className="text-xl sm:text-2xl shrink-0">⚠️</span>
            <div>
              <p className="mb-0.5 text-sm font-medium sm:mb-1 text-red-900">{t("deleteModal.confirm")}</p>
              <p className="text-xs text-red-700 sm:text-sm">{t("deleteModal.warning")}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={isDeleting} className="text-xs sm:text-sm">
              {t("deleteModal.cancel")}
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} isLoading={isDeleting} className="text-xs sm:text-sm">
              {t("deleteModal.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
