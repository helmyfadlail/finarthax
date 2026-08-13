import { prisma } from "@/lib";
import { APP_SETTINGS } from "@/static";

async function main() {
  console.log("🌱 Starting database seeding...\n");

  // ============================================
  // 1. RECONCILE APP SETTINGS
  // ============================================

  // Additive on purpose. Every deploy runs this seed, and app_settings is now edited from the admin
  // screen - wiping the table first (as this used to) would silently undo every change a superadmin
  // made, on every release. New keys are created; existing rows keep the value they hold.
  const existing = await prisma.appSetting.findMany({ select: { key: true } });
  const existingKeys = new Set(existing.map((setting) => setting.key));

  const missing = APP_SETTINGS.filter((setting) => !existingKeys.has(setting.key));

  if (missing.length > 0) {
    await prisma.appSetting.createMany({ data: missing.map((setting) => ({ ...setting })), skipDuplicates: true });
  }

  console.log(`  ✓ ${APP_SETTINGS.length} app settings checked — ${missing.length} added, ${APP_SETTINGS.length - missing.length} left as configured`);

  // ============================================
  // 2. PROMOTE THE SUPERADMIN
  // ============================================

  // The role is granted by email from the environment, not from anything a user can send: there is
  // no screen that hands out SUPERADMIN, so the first one has to come from the deploy.
  const superAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();

  if (!superAdminEmail) {
    console.log("  ℹ SUPERADMIN_EMAIL is not set — no superadmin promoted, app settings stay read-only in the UI");
  } else {
    const promoted = await prisma.user.updateMany({ where: { email: superAdminEmail }, data: { role: "SUPERADMIN" } });

    if (promoted.count > 0) {
      console.log(`  ✓ ${superAdminEmail} promoted to SUPERADMIN`);
    } else {
      // Registration comes first, promotion second - the seed cannot invent a password.
      console.log(`  ⚠ No account found for ${superAdminEmail} — register it first, then run the seed again`);
    }
  }

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
