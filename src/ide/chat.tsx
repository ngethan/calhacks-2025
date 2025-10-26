"use client";

import { FileIcon } from "@/components/file-icon";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentFileContext } from "@/ide/ai/context";
import { type FileEdit, applyDiff, parseFileEdits } from "@/ide/ai/diff-utils";
import { DiffViewer } from "@/ide/ai/diff-viewer";
import type { FileContext } from "@/ide/chat/context-utils";
import { FilePicker } from "@/ide/chat/file-picker";
import { useEditorState } from "@/ide/editor";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import { type Message, useChatStore } from "@/ide/stores/chat-store";
import { cn } from "@/lib/utils";
import {
  AtSign,
  Check,
  ChevronDown,
  Edit2,
  Loader2,
  MessageSquare,
  SendHorizontal,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  isUser = false,
}: {
  content: string;
  onAccept?: (edit: FileEdit) => void;
  onReject?: (edit: FileEdit) => void;
  isUser?: boolean;
}) {
  // For user messages, hide attached files context - just show the user's message
  if (isUser) {
    // Check if there are attached files and extract just the user's message
    const attachedFilesMatch = content.match(
      /\*\*Attached Files:\*\*([\s\S]*)/,
    );
    if (attachedFilesMatch) {
      // Only show the user's actual message, not the attached file context
      const userText = content
        .substring(0, content.indexOf("**Attached Files:**"))
        .trim();
      return <p className="whitespace-pre-wrap">{userText}</p>;
    }
    // No attached files, just return the regular content
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  // For assistant messages, parse file edits
  const edits = parseFileEdits(content);
  const hasEdits = edits.length > 0;

  // Remove complete file_edit tags and hide partial ones
  let displayContent = content
    // Remove complete file_edit tags
    .replace(/<file_edit>[\s\S]*?<\/file_edit>/g, "")
    .trim();

  // Check if there's an incomplete file_edit tag (streaming in progress)
  const hasIncompleteEdit =
    content.includes("<file_edit>") && !content.includes("</file_edit>");

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
  const [attachedFiles, setAttachedFiles] = useState<Set<string>>(new Set());
  const [showFilePicker, setShowFilePicker] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
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
      },
    );
  };

  const handleFileSelect = (file: FileContext) => {
    setAttachedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(file.path)) {
        newSet.delete(file.path);
      } else {
        newSet.add(file.path);
      }
      return newSet;
    });

    // Focus back on textarea
    textareaRef.current?.focus();
  };

  const handleRemoveFile = (filePath: string) => {
    setAttachedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(filePath);
      return newSet;
    });
  };

  const handleOpenFilePicker = () => {
    setShowFilePicker(!showFilePicker);
  };

  const handleAcceptEdit = async (edit: FileEdit) => {
    try {
      const normalizedPath = normalizeEditPath(edit.path);

      let finalContent: string;

      if (edit.diff) {
        // Apply diff to existing file
        const fileContent = fileSystem.getEditableFileContent(
          normalizedPath,
          true,
        );
        const currentContent =
          typeof fileContent === "string" ? fileContent : "";
        const patchedContent = applyDiff(currentContent, edit.diff);

        if (!patchedContent) {
          console.error(
            `[Chat] Failed to apply diff to ${edit.path} (resolved ${normalizedPath})`,
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
        `[Chat] Applied edit to ${edit.path} (resolved ${normalizedPath})`,
      );
    } catch (error) {
      console.error(`[Chat] Failed to apply edit to ${edit.path}:`, error);
    }
  };

  const handleRejectEdit = (edit: FileEdit) => {
    const normalizedPath = normalizeEditPath(edit.path);
    console.log(
      `[Chat] Rejected edit to ${edit.path} (resolved ${normalizedPath})`,
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
              content:
                "Generate a very short (2-4 words) title for this chat conversation. Only respond with the title, nothing else.",
            },
            {
              role: "user",
              content: `User: ${firstMessage}\n\nAssistant: ${response.substring(
                0,
                200,
              )}`,
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
        title = title
          .trim()
          .replace(/^["']|["']$/g, "")
          .substring(0, 50);

        if (title && activeSessionId) {
          renameSession(activeSessionId, title);
        }
      }
    } catch (error) {
      console.error("[Chat] Failed to generate title:", error);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort("User stopped the request");
      } catch (error) {
        // Ignore abort errors
      }
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !activeSessionId) return;

    // Build user message with attached files
    let messageContent = input;

    if (attachedFiles.size > 0) {
      const fileContents: string[] = [];

      for (const filePath of attachedFiles) {
        const content = fileSystem.getEditableFileContent(filePath, false);
        if (typeof content === "string") {
          fileContents.push(
            `\n\n--- File: ${filePath} ---\n${content}\n--- End of ${filePath} ---`,
          );
        }
      }

      if (fileContents.length > 0) {
        messageContent += `\n\n**Attached Files:**${fileContents.join("")}`;
      }
    }

    const userMessage: Message = { role: "user", content: messageContent };
    const isFirstMessage = messages.length === 0;

    // Clear attached files after sending
    setAttachedFiles(new Set());

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

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
            `[Chat] Message ${idx} has array content, converting to string`,
          );
          content = content
            .map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
            .join("\n");
        } else if (typeof content === "object" && content !== null) {
          console.warn(
            `[Chat] Message ${idx} has object content, converting to string`,
          );
          content = JSON.stringify(content);
        } else if (typeof content !== "string") {
          console.warn(
            `[Chat] Message ${idx} has ${typeof content} content, converting to string`,
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
      currentMessages.length,
    );
    console.log(
      "[Chat] Final messages being sent:",
      currentMessages.map((m) => ({
        role: m.role,
        contentType: typeof m.content,
        contentLength: m.content.length,
        contentPreview: m.content.substring(0, 100),
      })),
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
        signal: abortControllerRef.current?.signal,
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

      try {
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
      } catch (readError) {
        // If the stream was aborted, this is expected - silently handle it
        if (
          readError instanceof Error &&
          (readError.name === "AbortError" ||
            readError.message?.includes("abort"))
        ) {
          console.log("[Chat] Stream reading stopped by user");
          throw readError; // Re-throw to be caught by outer catch
        }
        throw readError;
      }

      console.log("[Chat] Final message length:", assistantMessage.length);

      // Generate title after first message
      if (isFirstMessage && assistantMessage) {
        generateChatTitle(input, assistantMessage);
      }
    } catch (error: any) {
      // Check if it was aborted by user
      if (error?.name === "AbortError" || error?.message?.includes("abort")) {
        console.log("[Chat] Request stopped by user");
        // Don't update with error message if user stopped it
      } else {
        console.error("[Chat] Error:", error);
        // Log error details safely
        try {
          console.error("[Chat] Error message:", error.message);
        } catch (e) {
          console.error("[Chat] Could not log error details");
        }
        // Update last message with error
        updateLastMessage(
          activeSessionId,
          "Sorry, an error occurred. Please try again.",
        );
      }
    } finally {
      console.log("[Chat] Finished. Setting isStreaming to false");
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Only send if not currently streaming
      if (!isStreaming) {
        void handleSend();
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full max-h-screen flex-col overflow-y-scroll bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-border/50 border-b px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setShowSessions(!showSessions)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <span className="truncate font-medium text-foreground text-xs">
            {activeSession?.name || "AI Chat"}
          </span>
        </div>
        {getCurrentFile() && !showSessions && (
          <span className="max-w-[120px] truncate rounded bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
            {getCurrentFile()?.path.split("/").pop()}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => createSession()}
        >
          @
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
        <div className="border-border/50 border-b bg-muted/30">
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1 p-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-muted/50",
                    session.id === activeSessionId && "bg-muted",
                  )}
                >
                  {editingSessionId === session.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
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
                        className="flex-1 truncate text-xs"
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
                        className="h-6 w-6 p-0 opacity-0 hover:text-destructive group-hover:opacity-100"
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
            <div className="flex h-full flex-col items-center justify-center px-4 py-12">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <div className="h-4 w-4 rounded-full bg-primary/20" />
              </div>
              <p className="text-center text-muted-foreground text-xs">
                Ask me anything about your code
              </p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-1 w-1 rounded-full",
                    msg.role === "user" ? "bg-primary" : "bg-muted-foreground",
                  )}
                />
                <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                  {msg.role === "user" ? "You" : "Assistant"}
                </span>
              </div>
              <div
                className={cn(
                  "rounded-md text-xs leading-relaxed",
                  msg.role === "user"
                    ? "ml-2.5 bg-primary/10 px-3 py-2 text-foreground"
                    : "ml-2.5 text-foreground/90",
                )}
              >
                <MessageContent
                  content={msg.content}
                  onAccept={handleAcceptEdit}
                  onReject={handleRejectEdit}
                  isUser={msg.role === "user"}
                />
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="ml-2.5 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-border/50 border-t bg-card">
        {/* Input with model selector */}
        <div className="relative px-4 py-3">
          {/* File Picker - positioned absolutely above input */}
          {showFilePicker && (
            <div className="absolute right-4 bottom-full left-4 z-50 mb-2">
              <FilePicker
                onSelect={handleFileSelect}
                onClose={() => setShowFilePicker(false)}
                searchQuery=""
                selectedFiles={attachedFiles}
                currentFilePath={getCurrentFile()?.path}
              />
            </div>
          )}

          <div className="relative rounded-lg border border-border bg-background/80">
            {/* @ button and attached file tabs at top */}
            <div className="flex flex-wrap items-center gap-1.5 border-border/50 border-b p-2">
              {/* @ button to attach files */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleOpenFilePicker}
                className="h-8 w-8"
                title="Attach files"
              >
                <AtSign className="h-4 w-4" />
              </Button>

              {/* Attached file tabs */}
              {Array.from(attachedFiles).map((filePath) => {
                const fileName = filePath.split("/").pop() || filePath;
                return (
                  <div
                    key={filePath}
                    className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 py-1 pr-1 pl-2 text-xs"
                  >
                    <FileIcon
                      node={{ file: { size: 0, isBinary: false } }}
                      name={fileName}
                    />
                    <span className="max-w-[120px] truncate font-medium">
                      {fileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(filePath)}
                      className="rounded p-0.5 opacity-60 transition-all hover:bg-destructive/20 hover:text-destructive hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask, learn, brainstorm"
              className="max-h-[200px] min-h-[80px] resize-none border-0 bg-transparent px-3 pt-3 pb-10 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            {/* Bottom bar with model selector and send buttons */}
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                {/* Model selector */}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  className="h-7 cursor-default px-2 font-normal text-muted-foreground text-xs hover:bg-transparent"
                >
                  claude-4.5-sonnet
                  <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
                </Button>
              </div>

              <div className="flex items-center gap-1">
                {isStreaming ? (
                  <Button
                    size="icon"
                    onClick={handleStop}
                    className="h-8 w-8"
                    variant="ghost"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={() => void handleSend()}
                    disabled={!input.trim()}
                    className="h-8 w-8 rounded-full"
                    variant={input.trim() ? "default" : "ghost"}
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
