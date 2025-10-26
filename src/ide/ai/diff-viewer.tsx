"use client";

import { Button } from "@/components/ui/button";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { FileEdit } from "./diff-utils";
import {
  SyntaxHighlightedCode,
  SyntaxHighlightedLine,
} from "./syntax-highlighter";

type DiffViewerProps = {
  edit: FileEdit;
  onAccept: () => void;
  onReject: () => void;
};

type DiffLine = {
  type: "add" | "delete" | "normal";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
};

function parseDiffToLines(diffText: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const diffLines = diffText.split("\n");

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of diffLines) {
    // Parse hunk header @@ -old +new @@
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLine = Number.parseInt(match[1] || "0");
        newLine = Number.parseInt(match[2] || "0");
        inHunk = true;
      }
      continue;
    }

    // Skip file headers
    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith("+")) {
      lines.push({
        type: "add",
        newLineNumber: newLine++,
        content: line.substring(1),
      });
    } else if (line.startsWith("-")) {
      lines.push({
        type: "delete",
        oldLineNumber: oldLine++,
        content: line.substring(1),
      });
    } else if (line.startsWith(" ")) {
      lines.push({
        type: "normal",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line.substring(1),
      });
    }
  }

  return lines;
}

export function DiffViewer({ edit, onAccept, onReject }: DiffViewerProps) {
  const [status, setStatus] = useState<"pending" | "accepted" | "rejected">(
    "pending",
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  const diffLines = useMemo(() => {
    if (!edit.diff) return [];
    try {
      return parseDiffToLines(edit.diff);
    } catch (error) {
      console.error("[DiffViewer] Error parsing diff:", error);
      return [];
    }
  }, [edit.diff]);

  const handleAccept = () => {
    setStatus("accepted");
    onAccept();
  };

  const handleReject = () => {
    setStatus("rejected");
    onReject();
  };

  // If it's a full content replacement, show a simple view
  if (edit.content && !edit.diff) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-muted/50">
        <div className="flex items-start justify-between gap-2 p-3 pb-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="break-all font-medium text-muted-foreground text-xs">
              {edit.path} (full file replacement)
            </span>
            {status === "pending" ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-2"
                  onClick={handleAccept}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={handleReject}
                >
                  <X className="mr-1 h-3 w-3" />
                  Reject
                </Button>
              </div>
            ) : (
              <span
                className={`font-medium text-xs ${
                  status === "accepted"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {status === "accepted" ? "✓ Accepted" : "✗ Rejected"}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 flex-shrink-0 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {!isCollapsed && (
          <SyntaxHighlightedCode
            code={edit.content || ""}
            filePath={edit.path}
          />
        )}
      </div>
    );
  }

  // Show diff view
  if (diffLines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-muted-foreground text-xs">
          Unable to parse diff for {edit.path}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-start justify-between gap-2 border-border border-b bg-muted/50 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="break-all font-medium text-muted-foreground text-xs">
            {edit.path}
          </span>
          {status === "pending" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="h-7 px-2"
                onClick={handleAccept}
              >
                <Check className="mr-1 h-3 w-3" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={handleReject}
              >
                <X className="mr-1 h-3 w-3" />
                Reject
              </Button>
            </div>
          ) : (
            <span
              className={`font-medium text-xs ${
                status === "accepted"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {status === "accepted" ? "✓ Accepted" : "✗ Rejected"}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 flex-shrink-0 p-0"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="max-h-[400px] overflow-x-auto overflow-y-auto font-mono">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {diffLines.map((line, idx) => (
                <tr
                  key={idx}
                  className={
                    line.type === "add"
                      ? "bg-green-500/10"
                      : line.type === "delete"
                        ? "bg-red-500/10"
                        : ""
                  }
                >
                  <td className="w-10 select-none border-border border-r bg-muted/30 px-2 py-0 text-right text-muted-foreground">
                    {line.oldLineNumber || ""}
                  </td>
                  <td className="w-10 select-none border-border border-r bg-muted/30 px-2 py-0 text-right text-muted-foreground">
                    {line.newLineNumber || ""}
                  </td>
                  <td className="px-3 py-0">
                    <pre className="inline">
                      <SyntaxHighlightedLine
                        code={line.content}
                        filePath={edit.path}
                      />
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
