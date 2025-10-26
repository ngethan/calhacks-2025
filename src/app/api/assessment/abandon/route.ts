import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { assessmentSession } from "@/server/db/schema/assessment-schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    // Verify the session belongs to the user
    const existingSession = await db.query.assessmentSession.findFirst({
      where: and(
        eq(assessmentSession.id, sessionId),
        eq(assessmentSession.userId, session.user.id),
      ),
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Assessment session not found" },
        { status: 404 },
      );
    }

    // Update session status
    await db
      .update(assessmentSession)
      .set({
        status: "abandoned",
      })
      .where(eq(assessmentSession.id, sessionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error abandoning assessment:", error);
    return NextResponse.json(
      { error: "Failed to abandon assessment" },
      { status: 500 },
    );
  }
}
