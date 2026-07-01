import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function roleForGoogleEmail(email: string) {
  const haydenEmail = normalized(process.env.HAYDEN_GOOGLE_EMAIL);
  const constanceEmail = normalized(process.env.CONSTANCE_GOOGLE_EMAIL);

  if (haydenEmail && email === haydenEmail) return "PARENT_A";
  if (constanceEmail && email === constanceEmail) return "PARENT_B";

  return null;
}

export async function getCurrentFamilyMember() {
  const session = await getServerSession(authOptions);
  const email = normalized(session?.user?.email);
  const role = roleForGoogleEmail(email);

  if (!role) return null;

  const member = await prisma.familyMember.findFirst({
    where: {
      familyId: DEMO_FAMILY_ID,
      role,
    },
    include: { user: true },
  });

  if (!member) return null;

  if (member.user.email.toLowerCase() !== email) {
    const user = await prisma.user.update({
      where: { id: member.userId },
      data: { email },
    });

    return { ...member, user, googleEmail: email };
  }

  return { ...member, googleEmail: email };
}

export async function requireCurrentFamilyMember() {
  const member = await getCurrentFamilyMember();

  if (!member) {
    redirect("/login");
  }

  return member;
}
