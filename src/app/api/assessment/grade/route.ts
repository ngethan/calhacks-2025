import { env } from "@/env";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import {
  assessmentSession,
  assessmentSubmission,
} from "@/server/db/schema/assessment-schema";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const openrouter = createOpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// Helper to filter main files from code submission
function getMainFiles(code: Record<string, unknown>): Record<string, string> {
  const mainFiles: Record<string, string> = {};

  // Type guard to check if files object exists
  if (!code.files || typeof code.files !== "object") {
    return mainFiles;
  }

  const files = code.files as Record<string, unknown>;

  // Only include important files (not node_modules, dist, etc)
  const importantPaths = [
    "/src/",
    "/app/",
    "/components/",
    "/pages/",
    "/lib/",
    "/utils/",
    "/hooks/",
  ];

  const skipPatterns = [
    "node_modules",
    ".next",
    "dist",
    "build",
    ".git",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ];

  for (const [path, content] of Object.entries(files)) {
    // Skip if path contains skip patterns
    if (skipPatterns.some((pattern) => path.includes(pattern))) {
      continue;
    }

    // Include if path contains important patterns or is a config file
    const isImportant = importantPaths.some((pattern) =>
      path.includes(pattern),
    );
    const isConfigFile =
      /\.(tsx?|jsx?|json|config\.(js|ts))$/.test(path) && !path.includes("/");

    if (isImportant || isConfigFile) {
      if (typeof content === "string") {
        mainFiles[path] = content;
      } else if (
        content &&
        typeof content === "object" &&
        "content" in content
      ) {
        mainFiles[path] = String((content as { content: unknown }).content);
      }
    }
  }

  return mainFiles;
}

function getGradingPrompt(
  challenge: string,
  framework: string,
  rubric: Record<string, unknown>,
  code: Record<string, string>,
): string {
  const codeString = Object.entries(code)
    .map(([path, content]) => `// ${path}\n${content}`)
    .join("\n\n---\n\n");

  return `You are an expert technical interviewer grading a coding assessment. The candidate used AI assistance during this assessment.

## CHALLENGE
${challenge}

## FRAMEWORK
${framework === "react-router-v7" ? "React Router v7" : "Next.js"}

## GRADING RUBRIC
${JSON.stringify(rubric, null, 2)}

## SUBMITTED CODE
${codeString}

## INSTRUCTIONS
1. Grade each category in the rubric based on the submitted code
2. Assign scores (0-100) for each category
3. Provide specific, actionable feedback that references actual code
4. Mark each criterion as "passed", "partial", or "failed"
5. Calculate the overall score using the weighted average from rubric
6. Assess AI utilization effectiveness (how well they used AI assistance)
7. Assess adherence to the original prompt/requirements
8. Be fair but rigorous - this was AI-assisted, so expectations are higher for code quality

## IMPORTANT
- Look for framework-specific best practices (${
    framework === "react-router-v7"
      ? "loaders, actions, routing"
      : "Server Components, Server Actions, App Router"
  })
- Consider code organization, error handling, and user experience
- Check if requirements were met
- Evaluate the quality of AI usage (clear variable names, good structure suggests good prompting)

## OUTPUT FORMAT
Return ONLY valid JSON in this exact structure:
{
  "overallScore": 82,
  "overallGrade": "Good",
  "categories": [
    {
      "name": "Category Name from Rubric",
      "score": 85,
      "grade": "Excellent|Great|Good|Needs Improvement|Poor",
      "feedback": "Specific feedback referencing actual code...",
      "criteria": [
        {
          "name": "Criterion Name",
          "status": "passed|partial|failed"
        }
      ]
    }
  ],
  "aiUtilization": {
    "effectiveness": 88,
    "feedback": "Analysis of how effectively AI was used..."
  },
  "adherenceToPrompt": 78,
  "strengths": ["Strength 1", "Strength 2"],
  "areasForImprovement": ["Area 1", "Area 2"]
}`;
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
    const { submissionId } = body;

    if (!submissionId) {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 },
      );
    }

    console.log("[Grade API] Starting grading for submission:", submissionId);

    // Fetch submission with session data
    const submission = await db.query.assessmentSubmission.findFirst({
      where: and(
        eq(assessmentSubmission.id, submissionId),
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

    if (submission.gradedAt) {
      return NextResponse.json(
        {
          error: "Submission already graded",
          results: JSON.parse(submission.feedback || "{}"),
        },
        { status: 200 },
      );
    }

    // Get the rubric from the session - retry if not available yet
    let rubric = submission.session.rubric as Record<string, unknown> | null;

    if (!rubric) {
      console.log(
        "[Grade API] ❌ Rubric not found in session, waiting for generation...",
      );
      console.log("[Grade API] Session ID:", submission.session.id);

      // Wait and retry up to 5 times (50 seconds total)
      for (let attempt = 1; attempt <= 5; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

        // Re-fetch the session to check for rubric
        const updatedSession = await db.query.assessmentSession.findFirst({
          where: eq(assessmentSession.id, submission.session.id),
        });

        if (updatedSession?.rubric) {
          rubric = updatedSession.rubric as Record<string, unknown>;
          console.log(`[Grade API] ✅ Rubric found after ${attempt} attempts`);
          console.log("[Grade API] Rubric has keys:", Object.keys(rubric));
          break;
        }

        console.log(
          `[Grade API] ⏳ Rubric still not found, attempt ${attempt}/5`,
        );
      }

      if (!rubric) {
        console.log(
          "[Grade API] ❌ Rubric generation timed out after 50 seconds",
        );
        return NextResponse.json(
          { error: "Rubric generation timed out. Please try again later." },
          { status: 408 }, // Request Timeout
        );
      }
    } else {
      console.log("[Grade API] ✅ Rubric found in session immediately");
      console.log("[Grade API] Rubric has keys:", Object.keys(rubric));
    }

    // Extract main files from code
    const mainFiles = getMainFiles(submission.code as Record<string, unknown>);

    if (Object.keys(mainFiles).length === 0) {
      return NextResponse.json(
        { error: "No code files found to grade" },
        { status: 400 },
      );
    }

    console.log(`[Grade API] Grading ${Object.keys(mainFiles).length} files`);

    // Call AI for grading
    const prompt = getGradingPrompt(
      submission.session.problemContent,
      submission.session.framework,
      rubric,
      mainFiles,
    );

    const result = await generateText({
      model: openrouter.chat("anthropic/claude-sonnet-4.5"),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for consistent grading
    });

    console.log("[Grade API] AI grading complete, parsing results...");

    // Parse AI response
    let gradingResults: Record<string, unknown>;
    try {
      const jsonMatch = result.text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      const jsonText = jsonMatch?.[1] ?? result.text;
      gradingResults = JSON.parse(jsonText.trim()) as Record<string, unknown>;
    } catch (parseError) {
      console.error("[Grade API] Failed to parse AI response:", parseError);
      console.error("[Grade API] AI response:", result.text);
      return NextResponse.json(
        { error: "Failed to parse grading results" },
        { status: 500 },
      );
    }

    // Update submission with results
    await db
      .update(assessmentSubmission)
      .set({
        score: String(gradingResults.overallScore),
        feedback: JSON.stringify(gradingResults),
        gradedAt: new Date(),
      })
      .where(eq(assessmentSubmission.id, submissionId));

    console.log(
      "[Grade API] ✅ Grading complete, score:",
      gradingResults.overallScore,
    );

    return NextResponse.json({
      success: true,
      results: gradingResults,
    });
  } catch (error) {
    console.error("[Grade API] Error:", error);
    return NextResponse.json(
      { error: "Failed to grade assessment" },
      { status: 500 },
    );
  }
}
