import { CONTENT_SETTINGS } from "./content";
import { CURRENCY_LOCALE_MAP, CURRENCY_OPTIONS, ZERO_DECIMAL_CURRENCIES } from "./currencies";
import { LANGUAGE_OPTIONS } from "./locales";
import { BUDGET_ALERT_THRESHOLD_OPTIONS, DATE_FORMAT_OPTIONS, DEFAULT_TRANSACTION_TYPE_OPTIONS, ITEMS_PER_PAGE_OPTIONS, RECURRING_LOOKAHEAD_DAYS_OPTIONS, THEME_OPTIONS } from "./preferences";

/** Choices offered by the preference selects, keyed `<preference>_options`. */
export const OPTION_SETTINGS = [
  {
    key: "currency_options",
    value: JSON.stringify(CURRENCY_OPTIONS),
    type: "json",
    category: "appearance",
    label: "Currency Options",
    description: "Available currency options",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "language_options",
    value: JSON.stringify(LANGUAGE_OPTIONS),
    type: "json",
    category: "appearance",
    label: "Language Options",
    description: "Available language options",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "theme_options",
    value: JSON.stringify(THEME_OPTIONS),
    type: "json",
    category: "appearance",
    label: "Theme Options",
    description: "Available theme options",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "date_format_options",
    value: JSON.stringify(DATE_FORMAT_OPTIONS),
    type: "json",
    category: "appearance",
    label: "Date Format Options",
    description: "Available date display formats",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "items_per_page_options",
    value: JSON.stringify(ITEMS_PER_PAGE_OPTIONS),
    type: "json",
    category: "preferences",
    label: "Items Per Page Options",
    description: "Available page sizes for lists",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "budget_alert_threshold_options",
    value: JSON.stringify(BUDGET_ALERT_THRESHOLD_OPTIONS),
    type: "json",
    category: "preferences",
    label: "Budget Alert Threshold Options",
    description: "Percentages that can trigger a budget warning",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "default_transaction_type_options",
    value: JSON.stringify(DEFAULT_TRANSACTION_TYPE_OPTIONS),
    type: "json",
    category: "preferences",
    label: "Default Transaction Type Options",
    description: "Transaction types that can be preselected in the add form",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "recurring_lookahead_days_options",
    value: JSON.stringify(RECURRING_LOOKAHEAD_DAYS_OPTIONS),
    type: "json",
    category: "preferences",
    label: "Recurring Lookahead Options",
    description: "How far ahead upcoming recurring transactions may be shown",
    sortOrder: 0,
    isPublic: true,
  },
];

/** How amounts are formatted per currency. */
export const CURRENCY_SETTINGS = [
  {
    key: "currency_locale_map",
    value: JSON.stringify(CURRENCY_LOCALE_MAP),
    type: "json",
    category: "currencies",
    label: "Currency Locale Map",
    description: "Mapping of currency to locale",
    sortOrder: 0,
    isPublic: true,
  },
  {
    key: "zero_decimal_currencies",
    value: JSON.stringify(ZERO_DECIMAL_CURRENCIES),
    type: "json",
    category: "currencies",
    label: "Zero Decimal Currencies",
    description: "Currencies without decimal fractions",
    sortOrder: 0,
    isPublic: true,
  },
];

/** Feature flags, read on every relevant request. */
export const FEATURE_SETTINGS = [
  { key: "allow_registration", value: "true", type: "boolean", category: "features", label: "Allow Registration", description: "Allow new users to register", sortOrder: 0, isPublic: false },
  { key: "maintenance_mode", value: "false", type: "boolean", category: "features", label: "Maintenance Mode", description: "Put app in maintenance mode", sortOrder: 0, isPublic: false },
];

/** Caps enforced by the API. */
export const LIMIT_SETTINGS = [
  {
    key: "max_accounts_per_user",
    value: "10",
    type: "number",
    category: "limits",
    label: "Max Accounts Per User",
    description: "Maximum accounts a user can create",
    sortOrder: 0,
    isPublic: false,
  },
  {
    key: "max_categories_per_user",
    value: "50",
    type: "number",
    category: "limits",
    label: "Max Categories Per User",
    description: "Maximum custom categories per user",
    sortOrder: 0,
    isPublic: false,
  },
  {
    key: "max_password_age_days",
    value: "90",
    type: "number",
    category: "limits",
    label: "Password Expiry Days",
    description: "Number of days before a user's password expires and must be changed",
    sortOrder: 0,
    isPublic: false,
  },
];

/** Shown on the settings screen. */
export const APP_INFO_SETTINGS = [
  { key: "app_version", value: "2.1.0", type: "string", category: "app_information", label: "App Version", description: "Current application version", sortOrder: 1, isPublic: true },
  { key: "app_created", value: "January 1, 2026", type: "string", category: "app_information", label: "Created", description: "Application creation date", sortOrder: 2, isPublic: true },
  { key: "app_build_number", value: "2026.08.02", type: "string", category: "app_information", label: "Build Number", description: "Current application build number", sortOrder: 3, isPublic: true },
  { key: "app_environment", value: "Production", type: "string", category: "app_information", label: "Environment", description: "Current application environment", sortOrder: 4, isPublic: true },
];

/** Everything the seed writes to `app_settings`. */
export const APP_SETTINGS = [...OPTION_SETTINGS, ...CURRENCY_SETTINGS, ...FEATURE_SETTINGS, ...LIMIT_SETTINGS, ...APP_INFO_SETTINGS, ...CONTENT_SETTINGS] as const;
