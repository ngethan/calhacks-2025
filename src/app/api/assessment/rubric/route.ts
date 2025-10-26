import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { assessmentSession } from "@/server/db/schema/assessment-schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, rubric } = body;

    if (!sessionId || !rubric) {
      return NextResponse.json(
        { error: "Session ID and rubric are required" },
        { status: 400 },
      );
    }

    // Verify the session belongs to the user (don't check status - it might be completed by now)
    const session_data = await db.query.assessmentSession.findFirst({
      where: and(
        eq(assessmentSession.id, sessionId),
        eq(assessmentSession.userId, session.user.id),
      ),
    });

    if (!session_data) {
      return NextResponse.json(
        { error: "Assessment session not found" },
        { status: 404 },
      );
    }

    // Update rubric
    const updated = await db
      .update(assessmentSession)
      .set({ rubric })
      .where(eq(assessmentSession.id, sessionId))
      .returning();

    return NextResponse.json({ session: updated[0] });
  } catch (error) {
    console.error("Error updating rubric:", error);
    return NextResponse.json(
      { error: "Failed to update rubric" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      // Get active session's rubric
      const activeSession = await db.query.assessmentSession.findFirst({
        where: and(
          eq(assessmentSession.userId, session.user.id),
          eq(assessmentSession.status, "active"),
        ),
      });

      if (!activeSession) {
        return NextResponse.json(
          { error: "No active assessment session found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        sessionId: activeSession.id,
        rubric: activeSession.rubric,
        framework: activeSession.framework,
        problemContent: activeSession.problemContent,
      });
    }

    // Get specific session's rubric
    const assessmentData = await db.query.assessmentSession.findFirst({
      where: and(
        eq(assessmentSession.id, sessionId),
        eq(assessmentSession.userId, session.user.id),
      ),
    });

    if (!assessmentData) {
      return NextResponse.json(
        { error: "Assessment session not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      sessionId: assessmentData.id,
      rubric: assessmentData.rubric,
      framework: assessmentData.framework,
      problemContent: assessmentData.problemContent,
    });
  } catch (error) {
    console.error("Error fetching rubric:", error);
    return NextResponse.json(
      { error: "Failed to fetch rubric" },
      { status: 500 },
    );
  }
}
