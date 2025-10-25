import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { env } from "@/env";
import { auth } from "@/lib/auth";

const openrouter = createOpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const requestSchema = z.object({
  challenge: z.string(),
  framework: z.enum(["react-router-v7", "nextjs"]),
});

const getGradingPrompt = (challenge: string, framework: string) => {
  const frameworkName = framework === "react-router-v7" ? "React Router v7" : "Next.js";
  
  return `You are an expert technical interviewer creating a holistic grading rubric for a coding assessment.

## Challenge
${challenge}

## Framework
The candidate will be implementing this using **${frameworkName}**.

## Your Task
Create a comprehensive, holistic grading rubric that evaluates the candidate's overall performance. The rubric should:

1. **Be framework-specific** - Include criteria relevant to ${frameworkName} best practices, patterns, and conventions
2. **Be holistic** - Focus on the overall quality of the solution rather than just checking boxes
3. **Account for AI assistance** - Remember candidates are using AI tools, so evaluate how effectively they leverage AI and their understanding of the code
4. **Prioritize practical skills** - Focus on real-world development abilities

## Rubric Structure

Generate a JSON object with this structure:

{
  "framework": "${frameworkName}",
  "totalPoints": 100,
  "passingScore": 70,
  "categories": [
    {
      "name": "Category Name",
      "weight": 30,
      "description": "What this category evaluates",
      "criteria": [
        {
          "aspect": "Specific aspect to evaluate",
          "points": 10,
          "description": "What to look for"
        }
      ]
    }
  ],
  "evaluationGuidelines": {
    "excellent": "90-100 points: Description of excellent work",
    "good": "75-89 points: Description of good work",
    "satisfactory": "70-74 points: Description of satisfactory work",
    "needsImprovement": "Below 70: Description of needs improvement"
  }
}

## Categories to Include (adapt as needed for the challenge):

### 1. ${frameworkName} Best Practices (25-30%)
- Proper use of ${frameworkName}-specific features (routing, data loading, etc.)
- Framework conventions and patterns
- Project structure and organization
${framework === "nextjs" ? "- Appropriate use of server/client components\n- Proper data fetching patterns (server actions, API routes, etc.)" : "- Proper loader/action usage\n- Route organization and nested routing"}

### 2. Code Quality & Architecture (20-25%)
- Component design and reusability
- Code organization and modularity
- Readability and maintainability
- Proper separation of concerns

### 3. Functionality & Completeness (20-25%)
- All required features implemented
- Features work as expected
- Edge cases handled
- Error boundaries and error handling

### 4. User Experience & Design (15-20%)
- Intuitive interface
- Responsive design
- Loading states and feedback
- Accessibility considerations

### 5. AI Tool Utilization & Understanding (10-15%)
- Effective use of AI assistance (not blind copy-paste)
- Understanding of generated code
- Ability to debug and modify AI suggestions
- Code demonstrates comprehension, not just compilation

### 6. Problem-Solving & Technical Decisions (10-15%)
- Appropriate technology choices
- Creative solutions to challenges
- Performance considerations
- Proper state management approach

## Important Guidelines:
- Make criteria specific to the challenge requirements
- Focus on WHAT the candidate accomplished, not just HOW
- Consider that candidates used AI - evaluate their ability to work WITH AI effectively
- Be realistic about what can be accomplished in a coding interview timeframe
- Prioritize functionality and user experience over perfection
- Include both objective (does it work?) and subjective (is it well-designed?) criteria

Output ONLY the JSON rubric, no additional text or markdown formatting.`;
};

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
      console.log("[Grading Rubric API] Unauthorized request");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { challenge, framework } = requestSchema.parse(body);

    console.log(
      "[Grading Rubric API] Generating rubric for user:",
      session.user.id,
      "with framework:",
      framework
    );

    try {
      const result = await generateText({
        model: openrouter.chat("anthropic/claude-sonnet-4.5"),
        messages: [
          {
            role: "user",
            content: getGradingPrompt(challenge, framework),
          },
        ],
        temperature: 0.5, // Lower temperature for more consistent rubrics
      });

      console.log("[Grading Rubric API] Generated rubric");

      // Parse the JSON response
      let rubric;
      try {
        // Try to extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = result.text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        const jsonText = jsonMatch?.[1] ?? result.text;
        rubric = JSON.parse(jsonText.trim());
      } catch (parseError) {
        console.error("[Grading Rubric API] Failed to parse JSON:", parseError);
        throw new Error("Failed to parse rubric JSON from AI response");
      }

      return new Response(
        JSON.stringify({
          ...rubric,
          generatedAt: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (generateError) {
      console.error("[Grading Rubric API] generateText error:", generateError);
      throw generateError;
    }
  } catch (error) {
    console.error("[Grading Rubric API] Error:", error);
    if (error instanceof z.ZodError) {
      console.error("[Grading Rubric API] Validation error:", error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.errors }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

