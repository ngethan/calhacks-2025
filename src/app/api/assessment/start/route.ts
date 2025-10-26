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
    const { framework, problemContent } = body;

    if (!framework || !problemContent) {
      return NextResponse.json(
        { error: "Framework and problem content are required" },
        { status: 400 },
      );
    }

    // Check if user already has an active session
    const existingSession = await db.query.assessmentSession.findFirst({
      where: and(
        eq(assessmentSession.userId, session.user.id),
        eq(assessmentSession.status, "active"),
      ),
    });

    if (existingSession) {
      return NextResponse.json(
        { error: "You already have an active assessment session" },
        { status: 400 },
      );
    }

    // Create new session
    const newSession = await db
      .insert(assessmentSession)
      .values({
        userId: session.user.id,
        framework,
        problemContent,
        status: "active",
      })
      .returning();

    return NextResponse.json({ session: newSession[0] });
  } catch (error) {
    console.error("Error creating assessment session:", error);
    return NextResponse.json(
      { error: "Failed to create assessment session" },
      { status: 500 },
    );
  }
}
