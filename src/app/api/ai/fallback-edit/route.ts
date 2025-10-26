import { env } from "@/env";
import { auth } from "@/lib/auth";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";

const requestSchema = z.object({
  path: z.string(),
  currentContent: z.string(),
  diff: z.string(),
  explanation: z.string().optional(),
});

// Allow up to 30 seconds for generation
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
      console.log("[Fallback Edit API] Unauthorized request");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    console.log("[Fallback Edit API] Received request for file:", body.path);

    const { path, currentContent, diff, explanation } = requestSchema.parse(body);

    // Build prompt for Claude Haiku to regenerate the file
    const prompt = `You are a helpful code assistant. A patch failed to apply to a file, and you need to manually apply the changes.

File: ${path}

Current File Content:
\`\`\`
${currentContent}
\`\`\`

Attempted Diff (that failed to apply):
\`\`\`diff
${diff}
\`\`\`

${explanation ? `Explanation of intended changes:\n${explanation}\n` : ""}

Please generate the COMPLETE updated file content with the intended changes applied. 
Output ONLY the file content, without any explanations, markdown formatting, or code blocks.
The output should be the raw file content that can be directly written to disk.`;

    console.log("[Fallback Edit API] Calling Claude Haiku...");

    // Use Claude Haiku for fast, cost-effective regeneration
    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      prompt,
    });

    console.log("[Fallback Edit API] Successfully generated new content");

    return new Response(
      JSON.stringify({
        success: true,
        content: result.text,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Fallback Edit API] Error:", error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid request", 
          details: error.errors 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to generate fallback content" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

