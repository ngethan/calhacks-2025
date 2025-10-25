"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import type { FileEdit } from "./diff-utils";

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
  const diffLines = diffText.split('\n');

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of diffLines) {
    // Parse hunk header @@ -old +new @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLine = parseInt(match[1] || '0');
        newLine = parseInt(match[2] || '0');
        inHunk = true;
      }
      continue;
    }

    // Skip file headers
    if (line.startsWith('---') || line.startsWith('+++')) {
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+')) {
      lines.push({
        type: 'add',
        newLineNumber: newLine++,
        content: line.substring(1)
      });
    } else if (line.startsWith('-')) {
      lines.push({
        type: 'delete',
        oldLineNumber: oldLine++,
        content: line.substring(1)
      });
    } else if (line.startsWith(' ')) {
      lines.push({
        type: 'normal',
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line.substring(1)
      });
    }
  }

  return lines;
}

export function DiffViewer({ edit, onAccept, onReject }: DiffViewerProps) {
  const [status, setStatus] = useState<"pending" | "accepted" | "rejected">("pending");

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
      <div className="border border-border rounded-lg p-3 bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            {edit.path} (full file replacement)
          </span>
          {status === "pending" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={handleAccept}
              >
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={handleReject}
              >
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          ) : (
            <span className={`text-xs font-medium ${status === "accepted" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {status === "accepted" ? "✓ Accepted" : "✗ Rejected"}
            </span>
          )}
        </div>
        <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-[300px]">
          <code>{edit.content}</code>
        </pre>
      </div>
    );
  }

  // Show diff view
  if (diffLines.length === 0) {
    return (
      <div className="border border-border rounded-lg p-3 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Unable to parse diff for {edit.path}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">
          {edit.path}
        </span>
        {status === "pending" ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={handleAccept}
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={handleReject}
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        ) : (
          <span className={`text-xs font-medium ${status === "accepted" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {status === "accepted" ? "✓ Accepted" : "✗ Rejected"}
          </span>
        )}
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto font-mono">
        <table className="w-full text-xs border-collapse">
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
                <td className="w-10 px-2 py-0 text-right text-muted-foreground select-none border-r border-border bg-muted/30">
                  {line.oldLineNumber || ""}
                </td>
                <td className="w-10 px-2 py-0 text-right text-muted-foreground select-none border-r border-border bg-muted/30">
                  {line.newLineNumber || ""}
                </td>
                <td className="px-3 py-0">
                  <pre className="inline">
                    <code
                      className={
                        line.type === "add"
                          ? "text-green-600 dark:text-green-400"
                          : line.type === "delete"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }
                    >
                      {line.content}
                    </code>
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
