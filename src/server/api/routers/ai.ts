import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { env } from "@/env";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const openrouter = createOpenAI({
	apiKey: env.OPENROUTER_API_KEY,
	baseURL: "https://openrouter.ai/api/v1",
});

export const aiRouter = createTRPCRouter({
	chat: protectedProcedure
		.input(
			z.object({
				messages: z.array(
					z.object({
						role: z.enum(["user", "assistant", "system"]),
						content: z.string(),
					}),
				),
				currentFile: z
					.object({
						path: z.string(),
						content: z.string(),
					})
					.optional(),
			}),
		)
		.mutation(async function* ({ input, ctx }) {
			const { messages, currentFile } = input;

			// Build system prompt with file context
			const systemPrompt = currentFile
				? `You are an AI coding assistant integrated into a code editor, similar to Cursor AI.

Current file being edited:
- Path: ${currentFile.path}
- Content:
\`\`\`
${currentFile.content}
\`\`\`

When suggesting code changes:
1. Provide clear explanations of what you're changing and why
2. Format code suggestions with proper syntax highlighting
3. For file edits, use this exact format:

<file_edit>
<path>${currentFile.path}</path>
<content>
... full updated file content here ...
</content>
</file_edit>

The user can then accept or reject your suggested changes.`
				: "You are an AI coding assistant. Help the user with their coding questions.";

			const result = streamText({
				model: openrouter.chat("anthropic/claude-3.5-sonnet"),
				messages: [
					{
						role: "system",
						content: systemPrompt,
					},
					...messages,
				],
			});

			for await (const chunk of result.textStream) {
				yield chunk;
			}
		}),
});
