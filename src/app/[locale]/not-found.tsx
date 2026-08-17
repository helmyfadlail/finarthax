import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NotFound() {
  const t = useTranslations("notFoundPage");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center bg-background">
      <h1 className="text-6xl font-bold text-primary-900 dark:text-primary-900">404</h1>
      <h2 className="text-xl font-medium text-primary-700 dark:text-primary-800">{t("title")}</h2>
      <p className="text-primary-600 dark:text-primary-700">{t("description")}</p>
      <Link href="/admin/dashboard" className="px-4 py-2 mt-2 text-sm text-on-solid dark:text-on-bright bg-primary-500 dark:bg-secondary-400 rounded-md hover:bg-primary-600 dark:hover:bg-secondary-500">
        {t("homeButton")}
      </Link>
    </div>
  );
}
