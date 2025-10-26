import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import {
  assessmentSession,
  assessmentSubmission,
} from "@/server/db/schema/assessment-schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Helper function to trigger grading in background
async function triggerGrading(submissionId: string, authHeaders: Headers) {
  try {
    // Call the grade endpoint with auth headers
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/assessment/grade`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authHeaders.get("cookie") || "",
        },
        body: JSON.stringify({ submissionId }),
      },
    );

    if (!response.ok) {
      console.error("[Submit API] Grading failed:", await response.text());
    } else {
      console.log("[Submit API] ✅ Grading triggered successfully");
    }
  } catch (error) {
    console.error("[Submit API] Error triggering grading:", error);
  }
}

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

    console.log("[Submit API] Creating submission for session:", sessionId);

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

    const submissionId = submission[0]?.id;
    console.log("[Submit API] Submission created:", submissionId);

    // Trigger grading in background (don't await) - pass request headers for auth
    triggerGrading(submissionId, request.headers).catch((err) =>
      console.error("[Submit API] Background grading error:", err),
    );

    return NextResponse.json({
      submission: submission[0],
      message: "Submission received. Grading in progress...",
    });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return NextResponse.json(
      { error: "Failed to submit assessment" },
      { status: 500 },
    );
  }
}
