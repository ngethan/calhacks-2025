"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditorState } from "@/ide/editor";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import { SendHorizontal, Loader2, X, Plus, MessageSquare, Trash2, Edit2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentFileContext } from "@/ide/ai/context";
import { parseFileEdits, applyDiff, type FileEdit } from "@/ide/ai/diff-utils";
import { DiffViewer } from "@/ide/ai/diff-viewer";
import { useChatStore, type Message } from "@/ide/stores/chat-store";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  // Remove complete file_edit tags and hide partial ones
  let displayContent = content
    // Remove complete file_edit tags
    .replace(/<file_edit>[\s\S]*?<\/file_edit>/g, "")
    .trim();

  // Check if there's an incomplete file_edit tag (streaming in progress)
  const hasIncompleteEdit = content.includes("<file_edit>") && !content.includes("</file_edit>");

  if (hasIncompleteEdit) {
    // Find where the incomplete edit starts and hide everything from there
    const incompleteStart = content.lastIndexOf("<file_edit>");
    if (incompleteStart !== -1) {
      displayContent = content.substring(0, incompleteStart).trim();
    }
  }

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

type ChatProps = {
  onClose?: () => void;
};

export const Chat = ({ onClose }: ChatProps) => {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorState = useEditorState();

  const {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    setActiveSession,
    renameSession,
    addMessage,
    updateLastMessage,
  } = useChatStore();

  // Create initial session if none exists
  useEffect(() => {
    if (sessions.length === 0) {
      createSession("New Chat");
    }
  }, [sessions.length, createSession]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

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

  const generateChatTitle = async (firstMessage: string, response: string) => {
    try {
      const titleResponse = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "Generate a very short (2-4 words) title for this chat conversation. Only respond with the title, nothing else.",
            },
            {
              role: "user",
              content: `User: ${firstMessage}\n\nAssistant: ${response.substring(0, 200)}`,
            },
          ],
        }),
      });

      if (!titleResponse.ok) return;

      const reader = titleResponse.body?.getReader();
      const decoder = new TextDecoder();
      let title = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          title += decoder.decode(value);
        }

        // Clean up the title
        title = title.trim().replace(/^["']|["']$/g, "").substring(0, 50);

        if (title && activeSessionId) {
          renameSession(activeSessionId, title);
        }
      }
    } catch (error) {
      console.error("[Chat] Failed to generate title:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !activeSessionId) return;

    const userMessage: Message = { role: "user", content: input };
    const isFirstMessage = messages.length === 0;

    // Add user message to store
    addMessage(activeSessionId, userMessage);

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

    setInput("");
    setIsStreaming(true);

    const currentFile = getCurrentFile();
    let assistantMessage = "";

    // Add empty assistant message to store
    addMessage(activeSessionId, { role: "assistant", content: "" });

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
      let buffer = ""; // Buffer to handle partial XML tags

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("[Chat] Stream complete. Total chunks:", chunkCount);
          break;
        }

        const chunk = decoder.decode(value);
        chunkCount++;
        buffer += chunk;
        assistantMessage += chunk;

        console.log(`[Chat] Chunk ${chunkCount}:`, chunk.substring(0, 50));

        // Update the last message in store
        updateLastMessage(activeSessionId, assistantMessage);
      }

      console.log("[Chat] Final message length:", assistantMessage.length);

      // Generate title after first message
      if (isFirstMessage && assistantMessage) {
        generateChatTitle(input, assistantMessage);
      }
    } catch (error) {
      console.error("[Chat] Error:", error);
      console.error("[Chat] Error details:", JSON.stringify(error, null, 2));

      // Update last message with error
      updateLastMessage(activeSessionId, "Sorry, an error occurred. Please try again.");
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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setShowSessions(!showSessions)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-foreground truncate">
            {activeSession?.name || "AI Chat"}
          </span>
        </div>
        {getCurrentFile() && !showSessions && (
          <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted/50 rounded truncate max-w-[120px]">
            {getCurrentFile()?.path.split('/').pop()}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => createSession()}
        >
          <Plus className="h-4 w-4" />
        </Button>
        {onClose && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sessions Sidebar */}
      {showSessions && (
        <div className="border-b border-border/50 bg-muted/30">
          <ScrollArea className="max-h-[200px]">
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors",
                    session.id === activeSessionId && "bg-muted"
                  )}
                >
                  {editingSessionId === session.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 text-xs bg-background px-2 py-1 rounded border border-border"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renameSession(session.id, editingName);
                            setEditingSessionId(null);
                          } else if (e.key === "Escape") {
                            setEditingSessionId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          renameSession(session.id, editingName);
                          setEditingSessionId(null);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        className="flex-1 text-xs truncate"
                        onClick={() => setActiveSession(session.id)}
                      >
                        {session.name}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(session.id);
                          setEditingName(session.name);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

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
