import { prisma } from "@/lib";
import { APP_SETTINGS } from "@/static";

async function main() {
  console.log("🌱 Starting database seeding...\n");
  // ============================================
  // 1. CREATE DEFAULT APP SETTINGS
  // ============================================

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
