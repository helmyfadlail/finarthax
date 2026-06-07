import { prisma } from "@/lib";

import { CURRENCY_LOCALE_MAP, CURRENCY_OPTIONS, LANGUAGE_OPTIONS, THEME_OPTIONS, ZERO_DECIMAL_CURRENCIES } from "@/static";

async function main() {
  console.log("🌱 Starting database seeding...\n");
  // ============================================
  // 1. CREATE DEFAULT APP SETTINGS
  // ============================================
  const APP_SETTINGS = [
    // options settings
    { key: "currency_options", value: JSON.stringify(CURRENCY_OPTIONS), type: "json", category: "appearance", label: "Currency Options", description: "Available currency options", isPublic: true },
    { key: "language_options", value: JSON.stringify(LANGUAGE_OPTIONS), type: "json", category: "appearance", label: "Language Options", description: "Available language options", isPublic: true },
    { key: "theme_options", value: JSON.stringify(THEME_OPTIONS), type: "json", category: "appearance", label: "Theme Options", description: "Available theme options", isPublic: true },

    // currencies settings
    {
      key: "currency_locale_map",
      value: JSON.stringify(CURRENCY_LOCALE_MAP),
      type: "json",
      category: "currencies",
      label: "Currency Locale Map",
      description: "Mapping of currency to locale",
      isPublic: true,
    },
    {
      key: "zero_decimal_currencies",
      value: JSON.stringify(ZERO_DECIMAL_CURRENCIES),
      type: "json",
      category: "currencies",
      label: "Zero Decimal Currencies",
      description: "Currencies without decimal fractions",
      isPublic: true,
    },

    // feature settings
    { key: "allow_registration", value: "true", type: "boolean", category: "features", label: "Allow Registration", description: "Allow new users to register", isPublic: false },
    { key: "maintenance_mode", value: "false", type: "boolean", category: "features", label: "Maintenance Mode", description: "Put app in maintenance mode", isPublic: false },

    // limits settings
    { key: "max_accounts_per_user", value: "10", type: "number", category: "limits", label: "Max Accounts Per User", description: "Maximum accounts a user can create", isPublic: false },
    { key: "max_categories_per_user", value: "50", type: "number", category: "limits", label: "Max Categories Per User", description: "Maximum custom categories per user", isPublic: false },

    // informational settings
    { key: "app_version", value: "1.6.3", type: "string", category: "app_information", label: "App Version", description: "Current application version", isPublic: true },
    { key: "app_created", value: "January 1, 2026", type: "string", category: "app_information", label: "Created", description: "Application creation date", isPublic: true },
    { key: "app_build_number", value: "2026.06.06", type: "string", category: "app_information", label: "Build Number", description: "Current application build number", isPublic: true },
    { key: "app_environment", value: "Production", type: "string", category: "app_information", label: "Environment", description: "Current application environment", isPublic: true },
    { key: "home_title", value: "Finarthax", type: "string", category: "general_information", label: "Home Title", description: "Main title on homepage", isPublic: true },
    { key: "how_it_works_title", value: "How it works:", type: "string", category: "general_information", label: "How It Works Title", description: "How it works section title", isPublic: true },
    { key: "ready_for_more_title", value: "Ready for More?", type: "string", category: "general_information", label: "Ready For More Title", description: "Marketing section title", isPublic: true },
    {
      key: "ready_for_more_description",
      value: "Create a free account to sync your data, set budgets, and access powerful analytics",
      type: "string",
      category: "general_information",
      label: "Ready For More Description",
      description: "Marketing section description",
      isPublic: true,
    },
    {
      key: "footer_copyright",
      value: "© 2026 Finarthax. All rights reserved.",
      type: "string",
      category: "general_information",
      label: "Footer Copyright",
      description: "Copyright text displayed in the website footer",
      isPublic: true,
    },
    {
      key: "home_subtitle",
      value: "Record your transactions instantly, no login required",
      type: "string",
      category: "general_information",
      label: "Home Subtitle",
      description: "Homepage subtitle",
      isPublic: true,
    },
    {
      key: "how_it_works_content",
      value: JSON.stringify([
        "Record transactions without creating an account",
        "Transactions saved locally on your device",
        "Perfect for quick expense tracking on the go",
        "Sign up later to sync and access advanced features",
      ]),
      type: "json",
      category: "general_information",
      label: "How It Works Content",
      description: "How it works section bullet points",
      isPublic: true,
    },
  ] as const;

  for (const setting of APP_SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: { ...setting },
    });
  }

  console.log(`  ✓ ${APP_SETTINGS.length} app settings seeded`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("═══════════════════════════════════════");
  console.log("🎉 DATABASE SEEDING COMPLETED!");
  console.log("═══════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
