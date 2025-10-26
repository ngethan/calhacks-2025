"use client";

import { FileIcon } from "@/components/file-icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentFileContext } from "@/ide/ai/context";
import { type FileEdit, applyDiff, parseFileEdits } from "@/ide/ai/diff-utils";
import { DiffViewer } from "@/ide/ai/diff-viewer";
import type { FileContext } from "@/ide/chat/context-utils";
import { FilePicker } from "@/ide/chat/file-picker";
import { CommandOutputCard } from "@/ide/chat/command-output-card";
import { useEditorState } from "@/ide/editor";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import { type Message, useChatStore } from "@/ide/stores/chat-store";
import { cn } from "@/lib/utils";
import {
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
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { getWebContainer } from "@/components/container";

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
  parts,
  onAccept,
  onReject,
  isUser = false,
}: {
  content: string;
  parts?: any[];
  onAccept?: (edit: FileEdit) => void;
  onReject?: (edit: FileEdit) => void;
  isUser?: boolean;
}) {
  // For user messages, hide attached files context - just show the user's message
  if (isUser) {
    // Check if there are attached files and extract just the user's message
    const attachedFilesMatch = content.match(
      /\*\*Attached Files:\*\*([\s\S]*)/
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

  // For assistant messages with parts (from useChat), render parts including tool calls
  if (parts && parts.length > 0) {
    return (
      <div className="space-y-3">
        {parts.map((part, idx) => {
          // Text parts
          if (part.type === "text") {
            return (
              <div
                key={idx}
                className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:text-sm prose-p:leading-snug prose-headings:tracking-tight [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
              >
                <Streamdown
                  parseIncompleteMarkdown={false}
                  shikiTheme={["github-dark", "github-dark"]}
                >
                  {part.text}
                </Streamdown>
              </div>
            );
          }

          // Handle all tool call parts generically
          if (part.type?.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "");
            
            // Input streaming state
            if (part.state === "input-streaming") {
              return (
                <div key={idx} className="rounded-md border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="font-medium text-foreground text-xs">
                      Calling {toolName}...
                    </span>
                  </div>
                </div>
              );
            }

            // Input available state
            if (part.state === "input-available") {
              return (
                <div key={idx} className="rounded-md border border-border/50 bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="font-medium text-foreground text-xs">
                      {toolName}
                    </span>
                  </div>
                  {part.input && (
                    <div className="mt-2 rounded-md bg-muted/50 p-2 font-mono text-[10px]">
                      <pre className="overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(part.input, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            }

            // Output available state - special handling for editFileWithPatch
            if (part.state === "output-available") {
              if (toolName === "editFileWithPatch") {
                const input = part.input as { path: string; diff: string; explanation: string } | undefined;
                
                if (!input?.path || !input?.diff) {
                  console.error("[Chat] Tool call missing required fields:", input);
                  return null;
                }

                const edit: FileEdit = {
                  path: input.path,
                  diff: input.diff,
                };
                
                return (
                  <DiffViewer
                    key={idx}
                    edit={edit}
                    onAccept={() => onAccept?.(edit)}
                    onReject={() => onReject?.(edit)}
                  />
                );
              }

              // Special handling for runCommand
              if (toolName === "runCommand") {
                const input = part.input as { command: string; cwd?: string; outputLimit?: number } | undefined;
                const output = part.output as string | undefined;
                
                if (!input?.command) {
                  console.error("[Chat] runCommand missing command:", input);
                  return null;
                }

                return (
                  <CommandOutputCard
                    key={idx}
                    command={input.command}
                    output={output || ""}
                    cwd={input.cwd}
                  />
                );
              }

              // Generic tool output display
              return (
                <div key={idx} className="rounded-md border border-green-500/30 bg-green-500/5 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-foreground text-xs">
                      {toolName}
                    </span>
                  </div>
                  
                  {/* Show input */}
                  {part.input && Object.keys(part.input).length > 0 && (
                    <div className="mb-2">
                      <div className="mb-1 text-[10px] text-muted-foreground uppercase">Input:</div>
                      <div className="rounded-md bg-muted/50 p-2 font-mono text-[10px]">
                        <pre className="overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(part.input, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {/* Show output */}
                  {part.output !== undefined && (
                    <div>
                      <div className="mb-1 text-[10px] text-muted-foreground uppercase">Output:</div>
                      <div className="rounded-md bg-muted/50 p-2 font-mono text-[10px]">
                        <pre className="overflow-x-auto whitespace-pre-wrap">
                          {typeof part.output === "string" 
                            ? part.output 
                            : JSON.stringify(part.output, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Error state
            if (part.state === "output-error") {
              return (
                <div key={idx} className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <X className="h-3.5 w-3.5 text-destructive" />
                    <span className="font-medium text-foreground text-xs">
                      {toolName} failed
                    </span>
                  </div>
                  <p className="text-destructive/90 text-xs">
                    {part.errorText || "Unknown error"}
                  </p>
                </div>
              );
            }
          }

          return null;
        })}
      </div>
    );
  }

  // Fallback for legacy format - parse file edits from content
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
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:text-sm prose-p:leading-snug prose-headings:tracking-tight [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
          <Streamdown
            parseIncompleteMarkdown={false}
            shikiTheme={["github-dark", "github-dark"]}
          >
            {displayContent}
          </Streamdown>
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
  const [showSessions, setShowSessions] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousFilePathRef = useRef<string | null>(null);
  const editorState = useEditorState();

  const {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    setActiveSession,
    renameSession,
    addAttachedFile,
    removeAttachedFile,
    setAttachedFiles,
  } = useChatStore();

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

  // Use the AI SDK's useChat hook
  const {
    messages: aiMessages,
    sendMessage,
    status,
    stop,
    addToolResult,
  } = useChat({
    id: activeSessionId || undefined,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      console.log("[!] -> toolCall", toolCall);
      const container = getWebContainer();
        if (!container?.webContainer || container.status !== "ready") {
          addToolResult({
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            tool: toolCall.toolName,
            errorText: "WebContainer not ready. Prompt the user to wait for the WebContainer to be ready, then try again.",
          })
          return;
        }
      if (toolCall.toolName === "listFiles") {
        const input = toolCall.input as { path: string };
        const files = await container.webContainer?.fs.readdir(input.path);
        addToolResult({
          toolCallId: toolCall.toolCallId,
          state: "output-available",
          tool: toolCall.toolName,
          output: JSON.stringify(files),
        });
      } else if (toolCall.toolName === "readFile") {
        const input = toolCall.input as { path: string };
        const file = await container.webContainer?.fs.readFile(input.path);
        addToolResult({
          toolCallId: toolCall.toolCallId,
          state: "output-available",
          tool: toolCall.toolName,
          output: file,
        });
      } else if (toolCall.toolName === "createFile") {
        const input = toolCall.input as { path: string; content: string };
        await container.webContainer?.fs.writeFile(input.path, input.content);
        addToolResult({
          toolCallId: toolCall.toolCallId,
          state: "output-available",
          tool: toolCall.toolName,
          output: "File created",
        });
      } else if (toolCall.toolName === "createFolder") {
        const input = toolCall.input as { path: string };
        await container.webContainer?.fs.mkdir(input.path, { recursive: false });
        addToolResult({
          toolCallId: toolCall.toolCallId,
          state: "output-available",
          tool: toolCall.toolName,
          output: "Folder created",
        });
      } else if (toolCall.toolName === "runCommand") {
        try {
          const input = toolCall.input as { command: string; cwd?: string; outputLimit?: number };
          const cwd = input.cwd ?? "/";
          // Split command into command name and args
          const commandParts = input.command.trim().split(/\s+/).filter(Boolean);
          if (commandParts.length === 0) {
            addToolResult({
              toolCallId: toolCall.toolCallId,
              state: "output-error",
              tool: toolCall.toolName,
              errorText: "No command provided",
            });
            return;
          }
          
          const commandName = commandParts[0]!;
          const commandArgs = commandParts.slice(1);
          
          console.log("Running command:", commandName, "with args:", commandArgs, "in directory:", cwd);
          
          const result = await container.webContainer?.spawn(commandName, commandArgs, {
            cwd,
          });
          
          let output = "";
          result.output.pipeTo(new WritableStream({ 
            write(data) { 
              output += data; 
            }
          }));
          await result.exit; // wait for the command to exit

          const slicedOutput = input.outputLimit ? output.slice(0, input.outputLimit) : output;
          addToolResult({
            toolCallId: toolCall.toolCallId,
            state: "output-available",
            tool: toolCall.toolName,
            output: slicedOutput,
          });
        } catch (error) {
          addToolResult({
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            tool: toolCall.toolName,
            errorText: error instanceof Error ? error.message : "Unknown error",
          });
          console.error("[Chat] Failed to run command:", error);
        }
      }
    },
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: {
        currentFile: getCurrentFile(),
      },
    }),
  });
  
  // Local state for input
  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  // Create initial session if none exists
  useEffect(() => {
    if (sessions.length === 0) {
      createSession("New Chat");
    }
  }, [sessions.length, createSession]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const attachedFiles = activeSession?.attachedFiles || [];
  
  // Convert AI SDK messages to our local Message format for display
  const messages: Message[] = aiMessages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join(""),
  }));

  // Memoize current file path to use as dependency
  const currentFilePath = useMemo(() => {
    const file = getCurrentFileContext(
      editorState.activeWindow,
      editorState.windows,
      (path) => {
        const content = fileSystem.getEditableFileContent(path, true);
        return typeof content === "string" ? content : null;
      }
    );
    return file?.path;
  }, [editorState.activeWindow, editorState.windows]);

  // Auto-track current file: whenever the active file changes, replace with current file
  useEffect(() => {
    if (!activeSessionId || !currentFilePath) return;

    // Only update if the file path has actually changed
    if (previousFilePathRef.current !== currentFilePath) {
      previousFilePathRef.current = currentFilePath;
      // Set to just the current file (this replaces previous auto-tracked file)
      setAttachedFiles(activeSessionId, [currentFilePath]);
    }
  }, [currentFilePath, activeSessionId, setAttachedFiles]);

  const handleFileSelect = (file: FileContext) => {
    if (!activeSessionId) return;

    if (attachedFiles.includes(file.path)) {
      removeAttachedFile(activeSessionId, file.path);
    } else {
      addAttachedFile(activeSessionId, file.path);
    }

    // Focus back on textarea
    textareaRef.current?.focus();
  };

  const handleRemoveFile = (filePath: string) => {
    if (!activeSessionId) return;
    removeAttachedFile(activeSessionId, filePath);
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
              content:
                "Generate a very short (2-4 words) title for this chat conversation. Only respond with the title, nothing else.",
            },
            {
              role: "user",
              content: `User: ${firstMessage}\n\nAssistant: ${response.substring(
                0,
                200
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
    stop();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeSessionId) return;

    // Build user message with attached files
    let messageContent = input;

    if (attachedFiles.length > 0) {
      const fileContents: string[] = [];

      for (const filePath of attachedFiles) {
        const content = fileSystem.getEditableFileContent(filePath, false);
        if (typeof content === "string") {
          fileContents.push(
            `\n\n--- File: ${filePath} ---\n${content}\n--- End of ${filePath} ---`
          );
        }
      }

      if (fileContents.length > 0) {
        messageContent += `\n\n**Attached Files:**${fileContents.join("")}`;
      }
    }

    const isFirstMessage = messages.length === 0;

    // Clear attached files and input
    setAttachedFiles(activeSessionId, []);
    setInput("");

    // Send the message using AI SDK's sendMessage
    sendMessage({ text: messageContent });

    // Generate title after first message (wait for response)
    if (isFirstMessage) {
      setTimeout(() => {
        const lastMessage = aiMessages[aiMessages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          const responseText = lastMessage.parts
            .filter((part) => part.type === "text")
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
          if (responseText) {
            generateChatTitle(messageContent, responseText);
          }
        }
      }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Only send if not currently streaming
      if (!isLoading) {
        void handleSend();
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="flex h-full max-h-screen flex-col overflow-y-scroll bg-card">
      {/* Header */}
      <div className="relative flex items-center gap-2 border-border/50 border-b px-3 py-2.5">
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
          className="h-6 w-6 p-0 text-md"
          onClick={() => createSession()}
        >
          +
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

        {/* Sessions Sidebar Dropdown */}
        {showSessions && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-[300px] overflow-y-auto rounded-md border border-border bg-card shadow-lg">
            <div className="space-y-1 p-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-muted/50",
                    session.id === activeSessionId && "bg-muted"
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
          </div>
        )}
      </div>

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
          {aiMessages.map((msg, idx) => {
            // Convert message parts to display content
            const textContent = msg.parts
              .filter((part) => part.type === "text")
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("");

            return (
              <div key={msg.id || idx} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "h-1 w-1 rounded-full",
                      msg.role === "user" ? "bg-primary" : "bg-muted-foreground"
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
                      : "ml-2.5 text-foreground/90"
                  )}
                >
                  <MessageContent
                    content={textContent}
                    parts={msg.parts}
                    onAccept={handleAcceptEdit}
                    onReject={handleRejectEdit}
                    isUser={msg.role === "user"}
                  />
                </div>
              </div>
            );
          })}
          {isLoading && (
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
                selectedFiles={new Set(attachedFiles)}
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
                @
              </Button>

              {/* Attached file tabs */}
              {attachedFiles.map((filePath) => {
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
              placeholder="Summarize this file..."
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
                {isLoading ? (
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
