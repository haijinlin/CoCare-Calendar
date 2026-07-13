import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentFamilyMember } from "@/lib/auth";
import { DEMO_FAMILY_ID } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentMember = await getCurrentFamilyMember();

    if (!currentMember) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const document = await prisma.document.findFirst({
      where: { id, familyId: DEMO_FAMILY_ID },
    });

    if (!document) {
      return new NextResponse("Not found", { status: 404 });
    }

    const result = await get(document.blobPathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    });

    if (!result) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (result.statusCode !== 200) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": `inline; filename="${document.fileName.replaceAll('"', "")}"`,
        "X-Content-Type-Options": "nosniff",
        ETag: result.blob.etag,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[document download failed]", error);
    return new NextResponse("Document is temporarily unavailable.", { status: 503 });
  }
}
