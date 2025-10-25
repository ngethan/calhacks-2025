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

function MessageContent({ content, onAccept, onReject }: {
  content: string;
  onAccept?: (edit: FileEdit) => void;
  onReject?: (edit: FileEdit) => void;
}) {
  const edits = parseFileEdits(content);
  const hasEdits = edits.length > 0;

  // Remove file_edit tags from display
  const displayContent = content.replace(/<file_edit>[\s\S]*?<\/file_edit>/g, "").trim();

  return (
    <div className="space-y-3">
      {displayContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm">{displayContent}</pre>
        </div>
      )}
      {hasEdits && edits.map((edit, idx) => (
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
        const fileContent = fileSystem.getEditableFileContent(normalizedPath, true);
        const currentContent = typeof fileContent === "string" ? fileContent : "";
        const patchedContent = applyDiff(currentContent, edit.diff);

        if (!patchedContent) {
          console.error(`[Chat] Failed to apply diff to ${edit.path} (resolved ${normalizedPath})`);
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

      await fileSystem.writeFileAsync(normalizedPath, finalContent, { source: 'external' });
      console.log(`[Chat] Applied edit to ${edit.path} (resolved ${normalizedPath})`);
    } catch (error) {
      console.error(`[Chat] Failed to apply edit to ${edit.path}:`, error);
    }
  };

  const handleRejectEdit = (edit: FileEdit) => {
    const normalizedPath = normalizeEditPath(edit.path);
    console.log(`[Chat] Rejected edit to ${edit.path} (resolved ${normalizedPath})`);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input };

    // Ensure all messages have simple string content for API compatibility
    // Filter out any malformed messages and convert to plain objects
    const sanitizedMessages = messages
      .filter(msg => {
        if (!msg || !msg.role || msg.content === undefined) return false;
        // Filter out empty assistant messages (from failed streams)
        if (msg.role === 'assistant' && (!msg.content || msg.content.trim() === '')) {
          console.log('[Chat] Filtering out empty assistant message');
          return false;
        }
        return true;
      })
      .map((msg, idx) => {
        let content = msg.content;

        // Handle various content types
        if (Array.isArray(content)) {
          console.warn(`[Chat] Message ${idx} has array content, converting to string`);
          content = content.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join('\n');
        } else if (typeof content === 'object' && content !== null) {
          console.warn(`[Chat] Message ${idx} has object content, converting to string`);
          content = JSON.stringify(content);
        } else if (typeof content !== 'string') {
          console.warn(`[Chat] Message ${idx} has ${typeof content} content, converting to string`);
          content = String(content);
        }

        return {
          role: msg.role as "user" | "assistant" | "system",
          content: content
        };
      });

    const currentMessages = [...sanitizedMessages, userMessage];

    console.log("[Chat] Sending message. Message count:", currentMessages.length);
    console.log("[Chat] Final messages being sent:", currentMessages.map(m => ({
      role: m.role,
      contentType: typeof m.content,
      contentLength: m.content.length,
      contentPreview: m.content.substring(0, 100)
    })));

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
        if (newMessages[newMessages.length - 1]?.role === "assistant" && !newMessages[newMessages.length - 1]?.content) {
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
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm">AI Chat</h2>
        {getCurrentFile() && (
          <p className="text-xs text-muted-foreground mt-1">
            Context: {getCurrentFile()?.path}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 py-4 px-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Ask me anything about your code...
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "space-y-2",
                msg.role === "user" ? "text-right" : "text-left"
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {msg.role === "user" ? "You" : "AI"}
              </div>
              <div
                className={cn(
                  "inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
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
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to help with your code..."
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
