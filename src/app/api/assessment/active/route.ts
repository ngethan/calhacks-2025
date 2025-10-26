import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { assessmentSession } from "@/server/db/schema/assessment-schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeAssessment = await db.query.assessmentSession.findFirst({
      where: and(
        eq(assessmentSession.userId, session.user.id),
        eq(assessmentSession.status, "active"),
      ),
    });

    return NextResponse.json({ session: activeAssessment });
  } catch (error) {
    console.error("Error fetching active session:", error);
    return NextResponse.json(
      { error: "Failed to fetch active session" },
      { status: 500 },
    );
  }
}
