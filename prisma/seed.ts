import { PrismaClient, ParentRole } from "@prisma/client";
import { generateCourtOrderCareBlocks2026 } from "../lib/court-order-schedule";
import { DEMO_FAMILY_ID } from "../lib/demo";

const prisma = new PrismaClient();

function envEmail(key: string, fallback: string) {
  return process.env[key]?.trim().toLowerCase() || fallback;
}

function familyName() {
  return process.env.FAMILY_NAME?.trim() || "CoCare Family";
}

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

async function upsertParent({
  familyId,
  role,
  name,
  email,
}: {
  familyId: string;
  role: ParentRole;
  name: string;
  email: string;
}) {
  const existingMember = await prisma.familyMember.findUnique({
    where: { familyId_role: { familyId, role } },
    include: { user: true },
  });

  if (existingMember) {
    const user = await prisma.user.update({
      where: { id: existingMember.userId },
      data: { name, email },
    });

    return user;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });

  await prisma.familyMember.create({
    data: { familyId, userId: user.id, role },
  });

  return user;
}

async function main() {
  const family = await prisma.family.upsert({
    where: { id: DEMO_FAMILY_ID },
    update: { name: familyName() },
    create: { id: DEMO_FAMILY_ID, name: familyName() },
  });

  await upsertParent({
    familyId: family.id,
    role: "PARENT_A",
    name: "Hayden Lin",
    email: envEmail("HAYDEN_GOOGLE_EMAIL", "parent-a@example.com"),
  });

  await upsertParent({
    familyId: family.id,
    role: "PARENT_B",
    name: "Constance Xie",
    email: envEmail("CONSTANCE_GOOGLE_EMAIL", "parent-b@example.com"),
  });

  const child = await prisma.child.upsert({
    where: { id: "demo-child" },
    update: { name: "Derick" },
    create: { id: "demo-child", familyId: family.id, name: "Derick" },
  });

  const existingBlocks = await prisma.careBlock.findMany({
    where: { familyId: family.id, source: "COURT_ORDER" },
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
      familyId: family.id,
      childId: child.id,
      source: "COURT_ORDER",
      ...block,
    }));

  if (missingBlocks.length > 0) {
    await prisma.careBlock.createMany({ data: missingBlocks });
  }

  console.log(
    `Bootstrap complete. Added ${missingBlocks.length} missing court-order care blocks. Existing requests, expenses, care credits, and manual care blocks were preserved.`,
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
