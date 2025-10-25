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
Your job is to create a coding challenge that tests candidates real-world web development skills. The challenge should simulate what a professional developer might encounter on the job.

Context:

Candidates will use an AI-assisted coding environment with a local development server. The rigor of the challenge should account for the user using ai assistance, while not being overly complex

Guidelines:
Focus on practical, open-ended tasks that require design and reasoning e.g., building an interactive component, implementing a CRUD flow, or integrating frontend logic.

The instructions should set a realistic scenario (e.g., a small feature request or mini-app) without over-specifying the implementation details. don't include things like schema or mock api routes. Provide 2 main features for the user to implement.

Avoid including unnecessary boilerplate and overspecification in your question. For context the app will be built using one of the following frameworks(you don't need to tell the user this): react router v7/nextjs/vue

don't include "optional extra features"

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

