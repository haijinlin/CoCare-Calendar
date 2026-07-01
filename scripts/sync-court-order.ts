import { PrismaClient } from "@prisma/client";
import { generateCourtOrderCareBlocks2026 } from "../lib/court-order-schedule";
import { DEMO_FAMILY_ID } from "../lib/demo";

const prisma = new PrismaClient();

function blockKey(block: {
  parentRole: string;
  startsAt: Date;
  endsAt: Date;
  handoverNote: string | null;
}) {
  return [
    block.parentRole,
    block.startsAt.toISOString(),
    block.endsAt.toISOString(),
    block.handoverNote ?? "",
  ].join("|");
}

async function main() {
  const child = await prisma.child.findFirstOrThrow({
    where: { familyId: DEMO_FAMILY_ID },
    orderBy: { createdAt: "asc" },
  });

  const existingBlocks = await prisma.careBlock.findMany({
    where: { familyId: DEMO_FAMILY_ID, source: "COURT_ORDER" },
    select: {
      parentRole: true,
      startsAt: true,
      endsAt: true,
      handoverNote: true,
    },
  });
  const existingKeys = new Set(existingBlocks.map(blockKey));
  const missingBlocks = generateCourtOrderCareBlocks2026()
    .filter((block) => !existingKeys.has(blockKey(block)))
    .map((block) => ({
      familyId: DEMO_FAMILY_ID,
      childId: child.id,
      source: "COURT_ORDER",
      ...block,
    }));

  if (missingBlocks.length === 0) {
    console.log("Court-order schedule is already up to date.");
    return;
  }

  await prisma.careBlock.createMany({ data: missingBlocks });
  console.log(`Added ${missingBlocks.length} court-order care blocks.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
