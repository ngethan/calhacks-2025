import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { assessmentSubmission } from "@/server/db/schema/assessment-schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Fetch submission with session data
    const submission = await db.query.assessmentSubmission.findFirst({
      where: and(
        eq(assessmentSubmission.id, id),
        eq(assessmentSubmission.userId, session.user.id),
      ),
      with: {
        session: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Parse feedback if it's graded
    let results = null;
    if (submission.gradedAt && submission.feedback) {
      try {
        results = JSON.parse(submission.feedback);
      } catch (e) {
        console.error("Failed to parse submission feedback:", e);
      }
    }

    return NextResponse.json({
      id: submission.id,
      submittedAt: submission.submittedAt,
      gradedAt: submission.gradedAt,
      score: submission.score,
      results,
      session: {
        framework: submission.session.framework,
        problemContent: submission.session.problemContent,
        startedAt: submission.session.startedAt,
        completedAt: submission.session.completedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching submission:", error);
    return NextResponse.json(
      { error: "Failed to fetch submission" },
      { status: 500 },
    );
  }
}
