"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useAppSettings, useDebounce } from "@/hooks";
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components";
import type { AppSettingType, ManagedAppSetting } from "@/types";

const TYPE_OPTIONS: Array<{ value: AppSettingType; label: string }> = [
  { value: "string", label: "🔤 string" },
  { value: "number", label: "🔢 number" },
  { value: "boolean", label: "🎚️ boolean" },
  { value: "json", label: "🧩 json" },
];

const CATEGORY_ICONS: Record<string, string> = {
  general: "🧭",
  features: "🚩",
  limits: "🚧",
  tuning: "🎛️",
  appearance: "🎨",
  preferences: "⚙️",
  currencies: "💱",
  content: "📝",
  app_information: "ℹ️",
};

interface FormState {
  key: string;
  label: string;
  category: string;
  type: AppSettingType;
  value: string;
  description: string;
  sortOrder: string;
  isPublic: boolean;
}

const EMPTY_FORM: FormState = {
  key: "",
  label: "",
  category: "general",
  type: "string",
  value: "",
  description: "",
  sortOrder: "0",
  isPublic: false,
};

const categoryIcon = (category: string): string => CATEGORY_ICONS[category] ?? "📦";

/** Categories are stored snake_case; `formatSettingKey` only handles camelCase, hence this one. */
const categoryLabel = (category: string): string =>
  category
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/** A stored value is always text; this is only how much of it fits on one row. */
const previewValue = (setting: ManagedAppSetting): string => {
  const flattened = setting.value.replace(/\s+/g, " ").trim();
  return flattened.length > 120 ? `${flattened.slice(0, 120)}…` : flattened || "—";
};

/** Long text and JSON get a textarea; a key or a number does not need one. */
const needsTextarea = (type: AppSettingType, value: string): boolean => type === "json" || value.length > 60;

const validate = (form: FormState, isCreate: boolean): string | null => {
  if (isCreate && !/^[a-z][a-z0-9_]*$/.test(form.key)) return "Key must be lower snake_case, e.g. recurring_history_days";
  if (!form.label.trim()) return "Label is required";
  if (!/^[a-z][a-z0-9_]*$/.test(form.category)) return "Category must be lower snake_case";
  if (form.type === "number" && !Number.isFinite(Number(form.value))) return "Value must be a number";
  if (form.type === "boolean" && !["true", "false"].includes(form.value)) return 'Value must be "true" or "false"';

  if (form.type === "json") {
    try {
      JSON.parse(form.value);
    } catch {
      return "Value must be valid JSON";
    }
  }

  return null;
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 sm:space-y-6">
    <Skeleton className="w-48 h-7 sm:w-72 sm:h-8" />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-20 sm:h-24" />
      ))}
    </div>
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-56 sm:h-64" />
    ))}
  </div>
);

export const AppSettings: React.FC = () => {
  const t = useTranslations("appSettingsPage");
  const { addToast } = useToast();
  const { status } = useSession();

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { isSuperAdmin, settings, categories, isLoading, createSetting, isCreating, updateSetting, isUpdating, deleteSetting, isDeleting } = useAppSettings({
    search: debouncedSearch || undefined,
    category: category || undefined,
  });

  const [editing, setEditing] = React.useState<ManagedAppSetting | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = React.useState<ManagedAppSetting | null>(null);

  const grouped = React.useMemo(() => {
    const groups = new Map<string, ManagedAppSetting[]>();
    for (const setting of settings) groups.set(setting.category, [...(groups.get(setting.category) ?? []), setting]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [settings]);

  const stats = React.useMemo(
    () => ({
      total: settings.length,
      public: settings.filter((setting) => setting.isPublic).length,
      internal: settings.filter((setting) => !setting.isPublic).length,
      custom: settings.filter((setting) => !setting.isCatalogue).length,
    }),
    [settings],
  );

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: category || "general" });
    setIsFormOpen(true);
  }, [category]);

  const openEdit = React.useCallback((setting: ManagedAppSetting) => {
    setEditing(setting);
    setForm({
      key: setting.key,
      label: setting.label,
      category: setting.category,
      type: setting.type,
      value: setting.value,
      description: setting.description ?? "",
      sortOrder: String(setting.sortOrder),
      isPublic: setting.isPublic,
    });
    setIsFormOpen(true);
  }, []);

  const closeForm = React.useCallback(() => {
    setIsFormOpen(false);
    setEditing(null);
  }, []);

  const handleChange = React.useCallback(<TField extends keyof FormState>(field: TField, value: FormState[TField]) => setForm((prev) => ({ ...prev, [field]: value })), []);

  const handleTypeChange = React.useCallback((next: AppSettingType) => {
    // Switching to boolean without seeding a valid value would leave the row failing validation
    // on a field the editor never touched.
    setForm((prev) => ({ ...prev, type: next, value: next === "boolean" && !["true", "false"].includes(prev.value) ? "false" : prev.value }));
  }, []);

  const handleSubmit = React.useCallback(() => {
    const error = validate(form, !editing);
    if (error) {
      addToast({ message: error, type: "error" });
      return;
    }

    const payload = {
      value: form.value,
      type: form.type,
      category: form.category.trim(),
      label: form.label.trim(),
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isPublic: form.isPublic,
    };

    if (editing) {
      updateSetting(
        { key: editing.key, data: payload },
        {
          onSuccess: () => {
            addToast({ message: t("toast.updated", { key: editing.key }), type: "success" });
            closeForm();
          },
          onError: (error: Error) => addToast({ message: error.message || t("toast.error"), type: "error" }),
        },
      );
      return;
    }

    createSetting(
      { ...payload, key: form.key.trim() },
      {
        onSuccess: () => {
          addToast({ message: t("toast.created", { key: form.key.trim() }), type: "success" });
          closeForm();
        },
        onError: (error: Error) => addToast({ message: error.message || t("toast.error"), type: "error" }),
      },
    );
  }, [form, editing, createSetting, updateSetting, addToast, closeForm, t]);

  const handleDelete = React.useCallback(() => {
    if (!pendingDelete) return;

    deleteSetting(pendingDelete.key, {
      onSuccess: () => {
        addToast({ message: t("toast.deleted", { key: pendingDelete.key }), type: "success" });
        setPendingDelete(null);
      },
      onError: (error: Error) => addToast({ message: error.message || t("toast.error"), type: "error" }),
    });
  }, [pendingDelete, deleteSetting, addToast, t]);

  if (status === "loading") return <LoadingSkeleton />;

  // The API refuses these routes on its own; this only spares a superadmin-less session a screen
  // full of red toasts.
  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-6 sm:mt-12">
        <Alert variant="warning" icon={<span className="text-xl">🔒</span>}>
          <AlertTitle>{t("restricted.title")}</AlertTitle>
          <AlertDescription>{t("restricted.description")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isSaving = isCreating || isUpdating;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl text-primary-900 dark:text-primary-900">{t("title")}</h1>
          <p className="mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("subtitle")}</p>
        </div>
        <Button variant="primary" size="lg" onClick={openCreate} responsiveFullWidth>
          ➕ {t("actions.new")}
        </Button>
      </div>

      <Alert variant="info" icon={<span className="text-xl">⚡</span>}>
        <AlertDescription>{t("liveHint")}</AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: t("summary.total"), value: stats.total, icon: "📦" },
          { label: t("summary.public"), value: stats.public, icon: "🌍" },
          { label: t("summary.internal"), value: stats.internal, icon: "🔒" },
          { label: t("summary.custom"), value: stats.custom, icon: "✨" },
        ].map((tile) => (
          <Card key={tile.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-primary-500 dark:text-primary-700">
                {tile.icon} {tile.label}
              </p>
              <p className="mt-1 text-xl font-bold sm:text-2xl text-primary-900 dark:text-primary-900 tabular-nums">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input type="search" placeholder={t("filters.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} icon={<span>🔍</span>} />
            </div>
            <Select
              options={[{ value: "", label: t("filters.allCategories") }, ...categories.map((item) => ({ value: item, label: `${categoryIcon(item)} ${categoryLabel(item)}` }))]}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton />
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-3xl">🗂️</p>
            <p className="mt-2 font-medium text-primary-900 dark:text-primary-900">{t("empty.title")}</p>
            <p className="mt-1 text-xs sm:text-sm text-primary-500 dark:text-primary-700">{t("empty.description")}</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(([groupName, rows]) => (
          <Card key={groupName}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">
                {categoryIcon(groupName)} {categoryLabel(groupName)}
              </CardTitle>
              <Badge variant="outline">{rows.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map((setting) => (
                <div
                  key={setting.id}
                  className="flex flex-col gap-2 p-3 transition-colors border rounded-lg border-primary-100 dark:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-300 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-primary-900 dark:text-primary-900">{setting.label}</p>
                      <Badge variant={setting.isPublic ? "info" : "default"}>{setting.isPublic ? t("badges.public") : t("badges.internal")}</Badge>
                      <Badge variant="outline">{setting.type}</Badge>
                      {setting.isCatalogue && <Badge variant="warning">{t("badges.builtIn")}</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-xs text-primary-500 dark:text-primary-700">{setting.key}</p>
                    <p className="mt-1 text-xs wrap-break-word sm:text-sm text-primary-700 dark:text-primary-800">{previewValue(setting)}</p>
                    {setting.description && <p className="mt-1 text-xs text-primary-400 dark:text-primary-600">{setting.description}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(setting)}>
                      ✏️ {t("actions.edit")}
                    </Button>
                    <Button variant="danger" size="sm" disabled={setting.isCatalogue} title={setting.isCatalogue ? t("builtInHint") : undefined} onClick={() => setPendingDelete(setting)}>
                      🗑️
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Modal isOpen={isFormOpen} onClose={closeForm} size="xl" title={editing ? t("modal.editTitle") : t("modal.createTitle")} description={editing ? editing.key : t("modal.keyHint")}>
        <div className="space-y-3">
          {!editing && <Input label={`${t("modal.key")} *`} placeholder="recurring_history_days" value={form.key} onChange={(e) => handleChange("key", e.target.value)} required />}

          <Input label={`${t("modal.label")} *`} placeholder="Recurring History Window" value={form.label} onChange={(e) => handleChange("label", e.target.value)} required />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={`${t("modal.category")} *`} placeholder="tuning" value={form.category} onChange={(e) => handleChange("category", e.target.value)} required />
            <Select label={t("modal.type")} options={TYPE_OPTIONS} value={form.type} onChange={(e) => handleTypeChange(e.target.value as AppSettingType)} />
          </div>

          {form.type === "boolean" ? (
            <Select
              label={t("modal.value")}
              options={[
                { value: "true", label: "✅ true" },
                { value: "false", label: "⛔ false" },
              ]}
              value={form.value}
              onChange={(e) => handleChange("value", e.target.value)}
            />
          ) : needsTextarea(form.type, form.value) ? (
            <Textarea label={t("modal.value")} rows={6} value={form.value} onChange={(e) => handleChange("value", e.target.value)} className="font-mono text-xs" />
          ) : (
            <Input
              type={form.type === "number" ? "number" : "text"}
              label={t("modal.value")}
              value={form.value}
              onChange={(e) => handleChange("value", e.target.value)}
              inputMode={form.type === "number" ? "decimal" : undefined}
            />
          )}

          {form.type === "json" && <p className="text-xs text-primary-500 dark:text-primary-700">{t("modal.valueHintJson")}</p>}

          <Textarea label={t("modal.description")} rows={2} value={form.description} onChange={(e) => handleChange("description", e.target.value)} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input type="number" label={t("modal.sortOrder")} value={form.sortOrder} onChange={(e) => handleChange("sortOrder", e.target.value)} min={0} />
            <div className="flex items-end">
              <label className="flex items-start w-full gap-2 p-3 border rounded-lg cursor-pointer border-primary-100 dark:border-primary-400">
                <input type="checkbox" checked={form.isPublic} onChange={(e) => handleChange("isPublic", e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-primary-500" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium sm:text-sm text-primary-900 dark:text-primary-900">{t("modal.isPublic")}</span>
                  <span className="block mt-0.5 text-xs text-primary-500 dark:text-primary-700">{t("modal.isPublicHint")}</span>
                </span>
              </label>
            </div>
          </div>

          {editing?.isCatalogue && (
            <Alert variant="warning" icon={<span>⚠️</span>}>
              <AlertDescription>{t("builtInHint")}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 mt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={closeForm} disabled={isSaving}>
            {t("actions.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSaving}>
            {editing ? t("actions.save") : t("actions.create")}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!pendingDelete} onClose={() => setPendingDelete(null)} size="md" title={t("delete.title")} description={pendingDelete?.key}>
        <p className="text-sm text-primary-700 dark:text-primary-800">{t("delete.description")}</p>
        <div className="flex flex-col-reverse gap-2 mt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={isDeleting}>
            {t("actions.cancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            {t("delete.confirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
