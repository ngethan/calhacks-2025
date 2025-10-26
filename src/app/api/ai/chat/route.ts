import { env } from "@/env";
import { auth } from "@/lib/auth";
import { createOpenAI } from "@ai-sdk/openai";
import { type UIMessage, convertToModelMessages, streamText, tool } from "ai";
import { z } from "zod";

const openrouter = createOpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const requestSchema = z.object({
  messages: z.array(z.any()), // UIMessage array from useChat
  currentFile: z
    .object({
      path: z.string(),
      content: z.string(),
    })
    .optional(),
});

// Tool for editing files with patches
const tools = {
  listFiles: tool({
    description: "List files in a directory",
    inputSchema: z.object({
      path: z.string().describe("The path to list files from"),
    }),
  }),
  readFile: tool({
    description: "Read a file",
    inputSchema: z.object({
      path: z.string().describe("The path to read the file from"),
    }),
  }),
  createFile: tool({
    description: "Create a file",
    inputSchema: z.object({
      path: z.string().describe("The path to create the file at"),
      content: z.string().describe("The content of the file"),
    }),
  }),
  createFolder: tool({
    description: "Create a folder",
    inputSchema: z.object({
      path: z.string().describe("The path to create the folder at"),
    }),
  }),
  runCommand: tool({
    description: "Run a command",
    inputSchema: z.object({
      command: z.string().describe("The command to run"),
      cwd: z
        .string()
        .describe("The working directory to run the command in")
        .optional(),
      outputLimit: z
        .number()
        .default(1000)
        .describe("The maximum number of characters to return in the output")
        .optional(),
    }),
    outputSchema: z
      .string()
      .describe("The output of the command (sliced to the outputLimit)"),
  }),
  editFileWithPatch: tool({
    description: `Edit a file by applying a unified diff patch. Use this tool when you want to suggest changes to code files. 
    
The patch should be in unified diff format with:
- File paths (--- and +++)
- Hunk headers (@@ -start,count +start,count @@)
- Context lines (starting with space)
- Removed lines (starting with -)
- Added lines (starting with +)

Include 3+ lines of context before and after changes for accurate patching.`,
    inputSchema: z.object({
      path: z
        .string()
        .describe("The file path to edit (e.g., /src/app/page.tsx)"),
      diff: z.string().describe(`The unified diff patch to apply. Example:
--- /src/app/page.tsx
+++ /src/app/page.tsx
@@ -1,5 +1,5 @@
 export default function Home() {
-  return <div>Hello</div>
+  return <div>Hello World</div>
 }
`),
      explanation: z
        .string()
        .describe("Brief explanation of what changes are being made and why"),
    }),
    execute: async ({ path, diff, explanation }) => {
      // This is executed on the server - we return the edit info
      // The client will handle actually applying it
      return {
        path,
        diff,
        explanation,
        status: "pending_approval",
        message: `Suggested edit to ${path}: ${explanation}`,
      };
    },
  }),
};

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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

    const {
      messages,
      currentFile,
    }: {
      messages: UIMessage[];
      currentFile?: { path: string; content: string };
    } = requestSchema.parse(body);

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

When suggesting code changes, you MUST use the editFileWithPatch tool:
1. Call editFileWithPatch with the file path, diff patch, and explanation
2. The diff should be in unified diff format with:
   - File paths (--- and +++)
   - Hunk headers (@@ -start,count +start,count @@)
   - Context lines (starting with space)
   - Removed lines (starting with -)
   - Added lines (starting with +)
3. Include at least 3 lines of context before and after changes
4. Provide a clear explanation of what you're changing and why

Example tool call:
{
  "path": "${currentFile.path}",
  "diff": "--- ${currentFile.path}\\n+++ ${currentFile.path}\\n@@ -10,3 +10,3 @@\\n function test() {\\n-  return false;\\n+  return true;\\n }",
  "explanation": "Changed return value from false to true to fix the logic"
}

The user can then accept or reject your suggested changes in the UI.`
      : "You are an AI coding assistant. Help the user with their coding questions. When you need to suggest code changes, use the editFileWithPatch tool.";

    console.log("[API] Converting messages for model...");

    const result = streamText({
      model: openrouter.chat("anthropic/claude-3.5-sonnet"),
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      tools,
      abortSignal: req.signal, // Support abort
    });

    console.log("[API] Stream created, returning UI message stream response");

    // Return the UI message stream (proper AI SDK format)
    return result.toUIMessageStreamResponse();
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
