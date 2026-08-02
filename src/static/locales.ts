export interface LocaleDefinition {
  value: string;
  label: string;
  flag: string;
}

export const LOCALE_DEFINITIONS: LocaleDefinition[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "id", label: "Indonesia", flag: "🇮🇩" },
  { value: "zh", label: "Chinese", flag: "🇨🇳" },
];

export const LOCALES = LOCALE_DEFINITIONS.map((locale) => locale.value);

export const DEFAULT_LOCALE = LOCALES[0];

export const LANGUAGE_OPTIONS = LOCALE_DEFINITIONS.map(({ value, label, flag }) => ({ value, label: `${flag} ${label}` }));

export const isSupportedLocale = (value?: string | null): boolean => !!value && LOCALES.includes(value);
