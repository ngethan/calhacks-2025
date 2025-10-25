"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditorState } from "@/ide/editor";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import { SendHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentFileContext } from "@/ide/ai/context";
import { parseFileEdits, applyDiff, type FileEdit } from "@/ide/ai/diff-utils";
import { DiffViewer } from "@/ide/ai/diff-viewer";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

const WORKSPACE_ROOT = "/home/workspace";

const normalizeEditPath = (rawPath: string) => {
  if (!rawPath) return rawPath;

  let normalized = rawPath.trim().replace(/\\/g, "/");

  if (normalized.startsWith(WORKSPACE_ROOT)) {
    normalized = normalized.slice(WORKSPACE_ROOT.length);
  }

  normalized = normalized.replace(/\/{2,}/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }

  const segments = normalized.split("/").filter(Boolean);
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") {
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }

  return `/${resolved.join("/")}`;
};

function MessageContent({
  content,
  onAccept,
  onReject,
}: {
  content: string;
  onAccept?: (edit: FileEdit) => void;
  onReject?: (edit: FileEdit) => void;
}) {
  const edits = parseFileEdits(content);
  const hasEdits = edits.length > 0;

  // Remove file_edit tags from display
  const displayContent = content
    .replace(/<file_edit>[\s\S]*?<\/file_edit>/g, "")
    .trim();

  return (
    <div className="space-y-3">
      {displayContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {displayContent}
          </pre>
        </div>
      )}
      {hasEdits &&
        edits.map((edit, idx) => (
          <DiffViewer
            key={idx}
            edit={edit}
            onAccept={() => onAccept?.(edit)}
            onReject={() => onReject?.(edit)}
          />
        ))}
    </div>
  );
}

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorState = useEditorState();

  const getCurrentFile = () => {
    return getCurrentFileContext(
      editorState.activeWindow,
      editorState.windows,
      (path) => {
        const content = fileSystem.getEditableFileContent(path, true);
        return typeof content === "string" ? content : null;
      }
    );
  };

  const handleAcceptEdit = async (edit: FileEdit) => {
    try {
      const normalizedPath = normalizeEditPath(edit.path);

      let finalContent: string;

      if (edit.diff) {
        // Apply diff to existing file
        const fileContent = fileSystem.getEditableFileContent(
          normalizedPath,
          true
        );
        const currentContent =
          typeof fileContent === "string" ? fileContent : "";
        const patchedContent = applyDiff(currentContent, edit.diff);

        if (!patchedContent) {
          console.error(
            `[Chat] Failed to apply diff to ${edit.path} (resolved ${normalizedPath})`
          );
          return;
        }

        finalContent = patchedContent;
      } else if (edit.content) {
        // Full file replacement
        finalContent = edit.content;
      } else {
        console.error("[Chat] Edit has neither diff nor content");
        return;
      }

      await fileSystem.writeFileAsync(normalizedPath, finalContent, {
        source: "external",
      });
      console.log(
        `[Chat] Applied edit to ${edit.path} (resolved ${normalizedPath})`
      );
    } catch (error) {
      console.error(`[Chat] Failed to apply edit to ${edit.path}:`, error);
    }
  };

  const handleRejectEdit = (edit: FileEdit) => {
    const normalizedPath = normalizeEditPath(edit.path);
    console.log(
      `[Chat] Rejected edit to ${edit.path} (resolved ${normalizedPath})`
    );
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input };

    // Ensure all messages have simple string content for API compatibility
    // Filter out any malformed messages and convert to plain objects
    const sanitizedMessages = messages
      .filter((msg) => {
        if (!msg || !msg.role || msg.content === undefined) return false;
        // Filter out empty assistant messages (from failed streams)
        if (
          msg.role === "assistant" &&
          (!msg.content || msg.content.trim() === "")
        ) {
          console.log("[Chat] Filtering out empty assistant message");
          return false;
        }
        return true;
      })
      .map((msg, idx) => {
        let content = msg.content;

        // Handle various content types
        if (Array.isArray(content)) {
          console.warn(
            `[Chat] Message ${idx} has array content, converting to string`
          );
          content = content
            .map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
            .join("\n");
        } else if (typeof content === "object" && content !== null) {
          console.warn(
            `[Chat] Message ${idx} has object content, converting to string`
          );
          content = JSON.stringify(content);
        } else if (typeof content !== "string") {
          console.warn(
            `[Chat] Message ${idx} has ${typeof content} content, converting to string`
          );
          content = String(content);
        }

        return {
          role: msg.role as "user" | "assistant" | "system",
          content: content,
        };
      });

    const currentMessages = [...sanitizedMessages, userMessage];

    console.log(
      "[Chat] Sending message. Message count:",
      currentMessages.length
    );
    console.log(
      "[Chat] Final messages being sent:",
      currentMessages.map((m) => ({
        role: m.role,
        contentType: typeof m.content,
        contentLength: m.content.length,
        contentPreview: m.content.substring(0, 100),
      }))
    );

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    const currentFile = getCurrentFile();
    let assistantMessage = "";

    // Add empty assistant message that we'll update
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: currentMessages,
          currentFile,
        }),
      });

      console.log("[Chat] Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      console.log("[Chat] Starting to read stream...");
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("[Chat] Stream complete. Total chunks:", chunkCount);
          break;
        }

        const chunk = decoder.decode(value);
        chunkCount++;
        assistantMessage += chunk;

        console.log(`[Chat] Chunk ${chunkCount}:`, chunk.substring(0, 50));

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: assistantMessage,
          };
          return newMessages;
        });
      }

      console.log("[Chat] Final message length:", assistantMessage.length);
    } catch (error) {
      console.error("[Chat] Error:", error);
      console.error("[Chat] Error details:", JSON.stringify(error, null, 2));
      setMessages((prev) => {
        const newMessages = [...prev];
        if (
          newMessages[newMessages.length - 1]?.role === "assistant" &&
          !newMessages[newMessages.length - 1]?.content
        ) {
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: "Sorry, an error occurred. Please try again.",
          };
        } else {
          newMessages.push({
            role: "assistant",
            content: "Sorry, an error occurred. Please try again.",
          });
        }
        return newMessages;
      });
    } finally {
      console.log("[Chat] Finished. Setting isStreaming to false");
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/50 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-foreground">AI Chat</span>
        </div>
        {getCurrentFile() && (
          <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted/50 rounded">
            {getCurrentFile()?.path.split('/').pop()}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-12 px-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <div className="w-4 h-4 rounded-full bg-primary/20" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ask me anything about your code
              </p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className="space-y-1.5"
            >
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  msg.role === "user" ? "bg-primary" : "bg-muted-foreground"
                )} />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {msg.role === "user" ? "You" : "Assistant"}
                </span>
              </div>
              <div
                className={cn(
                  "rounded-md text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary/10 text-foreground px-3 py-2 ml-2.5"
                    : "text-foreground/90 ml-2.5"
                )}
              >
                {msg.role === "assistant" ? (
                  <MessageContent
                    content={msg.content}
                    onAccept={handleAcceptEdit}
                    onReject={handleRejectEdit}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex items-center gap-2 text-muted-foreground ml-2.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/50">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to help with your code..."
            className="min-h-[80px] max-h-[200px] resize-none text-xs pr-10 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50"
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 bottom-2 h-7 w-7"
            variant={input.trim() ? "default" : "ghost"}
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SendHorizontal className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          ⏎ to send · ⇧⏎ for new line
        </p>
      </div>
    </div>
  );
};
