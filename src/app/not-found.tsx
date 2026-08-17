import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center bg-background">
      <h1 className="text-6xl font-bold text-primary-900 dark:text-primary-900">404</h1>
      <h2 className="text-xl font-medium text-primary-700 dark:text-primary-800">Page not found</h2>
      <p className="text-primary-600 dark:text-primary-700">The page you are looking for does not exist or has been moved.</p>
      <Link href="/" className="px-4 py-2 mt-2 text-sm text-on-solid dark:text-on-bright bg-primary-500 dark:bg-secondary-400 rounded-md hover:bg-primary-600 dark:hover:bg-secondary-500">
        Go home
      </Link>
    </div>
  );
}
