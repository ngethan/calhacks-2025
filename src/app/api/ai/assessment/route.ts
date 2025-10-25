import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { env } from "@/env";
import { auth } from "@/lib/auth";

const openrouter = createOpenAI({
	apiKey: env.OPENROUTER_API_KEY,
	baseURL: "https://openrouter.ai/api/v1",
});

const USER_PROMPT = `
You are an expert software engineering interviewer designing realistic, practical coding assessments.

Your goal:
Create a coding challenge that tests real-world web development skills in a **browser-only environment**. The challenge should simulate what a professional developer might encounter on the job.

Context:
- Candidates will use an AI-assisted coding environment with a **local development server**.
- There is **no access to external databases or APIs**. 
- Use **local JSON storage or in-memory data structures** for persistence.
- The purpose of this challenge is to **evaluate how effectively candidates can program with AI tools or agents**, not their memorization of syntax.

Guidelines:
1. Focus on **practical, open-ended tasks** that require design and reasoning — e.g., building an interactive component, implementing a CRUD flow, or integrating frontend logic.
2. The instructions should **set a realistic scenario** (e.g., a small feature request or mini-app) without over-specifying the implementation details.
3. Avoid unnecessary boilerplate or trivial algorithmic problems.
4. The result should be a **single, self-contained task** that can run fully in the browser.

Output:
Write the challenge prompt in a clear, candidate-facing tone.
`;

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({ headers: req.headers });

        if (!session?.user) {
            console.log("[Assessment API] Unauthorized request");
            return new Response("Unauthorized", { status: 401 });
        }

	console.log("[Assessment API] Generating assessment for user:", session.user.id);

	try {
		const result = await generateText({
			model: openrouter.chat("openai/gpt-5"),
			messages: [
				{
					role: "user",
					content: USER_PROMPT,
				},
			],
			temperature: 0.8,
		});

		console.log("[Assessment API] Generated assessment:", result.text);

		return new Response(JSON.stringify({ 
			content: result.text,
			generatedAt: new Date().toISOString()
		}), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (generateError) {
		console.error("[Assessment API] generateText error:", generateError);
		throw generateError;
	}
    } catch (error) {
        console.error("[Assessment API] Error:", error);
        if (error instanceof z.ZodError) {
            console.error("[Assessment API] Validation error:", error.errors);
            return new Response(
                JSON.stringify({ error: "Invalid request", details: error.errors }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }
        return new Response(
            JSON.stringify({
                error: "Internal Server Error",
                message: error instanceof Error ? error.message : "Unknown error"
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
}

