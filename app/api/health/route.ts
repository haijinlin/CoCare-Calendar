import { NextResponse } from "next/server";
import { getDeployReadiness } from "@/lib/deploy-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = await getDeployReadiness();

  return NextResponse.json(readiness, {
    status: readiness.ok ? 200 : 503,
  });
}
