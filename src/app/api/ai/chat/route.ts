import { env } from "@/env";
import { auth } from "@/lib/auth";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";

const openrouter = createOpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const requestSchema = z.object({
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
});

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
      console.log("[API] Unauthorized request");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    console.log(
      "[API] Received request with",
      body.messages?.length,
      "messages",
    );

    // Log each message to debug
    body.messages?.forEach((msg: any, idx: number) => {
      console.log(`[API] Message ${idx}:`, {
        role: msg.role,
        contentType: typeof msg.content,
        isArray: Array.isArray(msg.content),
        contentPreview:
          typeof msg.content === "string"
            ? msg.content.substring(0, 100)
            : JSON.stringify(msg.content).substring(0, 100),
      });
    });

    const { messages, currentFile } = requestSchema.parse(body);
    console.log("[API] Parsed successfully. Current file:", currentFile?.path);

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
2. Use unified diff format for changes (this is more efficient than sending full files)
3. For file edits, use this exact format:

<file_edit>
<path>${currentFile.path}</path>
<diff>
--- ${currentFile.path}
+++ ${currentFile.path}
@@ -start_line,num_lines +start_line,num_lines @@
 context line
-removed line
+added line
 context line
</diff>
</file_edit>

IMPORTANT:
- Use proper unified diff format with @@ headers
- Include at least 3 lines of context before and after changes
- Multiple hunks are allowed for changes in different parts of the file
- If you're creating a new file or the changes are extensive (>50% of file), you can use <content> instead of <diff>

The user can then accept or reject your suggested changes.`
      : "You are an AI coding assistant. Help the user with their coding questions.";

    console.log(
      "[API] Calling OpenRouter with",
      messages.length + 1,
      "total messages",
    );

    // Log the actual messages being sent to streamText
    const messagesToSend = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...messages,
    ];

    console.log("[API] Messages to send to OpenRouter:");
    messagesToSend.forEach((msg, idx) => {
      console.log(
        `  ${idx}: role=${msg.role}, contentType=${typeof msg.content}, isArray=${Array.isArray(msg.content)}, contentLength=${msg.content.length}`,
      );
    });

    try {
      const result = streamText({
        model: openrouter.chat("anthropic/claude-3.5-sonnet"),
        messages: messagesToSend,
      });

      console.log("[API] Stream created, returning response");
      // Return the text stream
      return result.toTextStreamResponse();
    } catch (streamError) {
      console.error("[API] streamText error:", streamError);
      console.error(
        "[API] streamText error details:",
        JSON.stringify(streamError, null, 2),
      );
      throw streamError;
    }
  } catch (error) {
    console.error("[API] Chat error:", error);
    if (error instanceof z.ZodError) {
      console.error("[API] Validation error:", error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.errors }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}
