import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import {
  assessmentSession,
  assessmentSubmission,
} from "@/server/db/schema/assessment-schema";
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
    const { sessionId, code } = body;

    if (!sessionId || !code) {
      return NextResponse.json(
        { error: "Session ID and code are required" },
        { status: 400 },
      );
    }

    // Verify the session belongs to the user and is active
    const activeSession = await db.query.assessmentSession.findFirst({
      where: and(
        eq(assessmentSession.id, sessionId),
        eq(assessmentSession.userId, session.user.id),
        eq(assessmentSession.status, "active"),
      ),
    });

    if (!activeSession) {
      return NextResponse.json(
        { error: "Active assessment session not found" },
        { status: 404 },
      );
    }

    // Create submission
    const submission = await db
      .insert(assessmentSubmission)
      .values({
        sessionId,
        userId: session.user.id,
        code,
      })
      .returning();

    // Mark session as completed
    await db
      .update(assessmentSession)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(assessmentSession.id, sessionId));

    return NextResponse.json({ submission: submission[0] });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return NextResponse.json(
      { error: "Failed to submit assessment" },
      { status: 500 },
    );
  }
}
