/**
 * One-time migration script: Copy `name` → `provider` for existing LLMProvider rows.
 * Run with: npx tsx prisma/migrate-provider-column.ts
 * Safe to delete after running.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.lLMProvider.findMany();
  console.log(`Found ${providers.length} providers to migrate`);

  for (const p of providers) {
    if (p.provider === 'custom' && p.name !== 'custom') {
      // The provider column still has the default — copy from name
      await prisma.lLMProvider.update({
        where: { id: p.id },
        data: { provider: p.name },
      });
      console.log(`  Updated provider ${p.id}: name="${p.name}" → provider="${p.name}"`);
    } else {
      console.log(`  Skipped provider ${p.id}: name="${p.name}", provider="${p.provider}" (already set)`);
    }
  }

  console.log('Migration complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
