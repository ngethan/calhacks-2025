import { parseDiff } from "react-diff-view";
import * as Diff from "diff";

export type FileEdit = {
  path: string;
  diff?: string;
  content?: string; // For full file replacements
};

/**
 * Parse file edits from AI response
 */
export function parseFileEdits(text: string): FileEdit[] {
  const edits: FileEdit[] = [];
  const regex =
    /<file_edit>\s*<path>(.*?)<\/path>\s*(?:<diff>(.*?)<\/diff>|<content>(.*?)<\/content>)\s*<\/file_edit>/gs;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const path = match[1]?.trim() ?? "";
    const diff = match[2]?.trim();
    const content = match[3]?.trim();

    edits.push({
      path,
      diff: diff || undefined,
      content: content || undefined,
    });
  }

  return edits;
}

/**
 * Apply a unified diff to source content
 */
export function applyDiff(
  originalContent: string,
  diffText: string,
): string | null {
  try {
    // Parse the diff using the diff library
    const patches = Diff.parsePatch(diffText);

    if (patches.length === 0 || !patches[0]) {
      return null;
    }

    // Apply the patch
    const result = Diff.applyPatch(originalContent, patches[0]);

    if (result === false) {
      console.error("[Diff] Failed to apply patch");
      return null;
    }

    return result;
  } catch (error) {
    console.error("[Diff] Error applying diff:", error);
    return null;
  }
}

/**
 * Parse unified diff for rendering with react-diff-view
 */
export function parseDiffForViewer(diffText: string) {
  try {
    return parseDiff(diffText);
  } catch (error) {
    console.error("[Diff] Error parsing diff for viewer:", error);
    return [];
  }
}

/**
 * Create a unified diff from old and new content
 * Useful for generating diffs on the client side
 */
export function createDiff(
  oldContent: string,
  newContent: string,
  filename: string,
): string {
  const patch = Diff.createPatch(
    filename,
    oldContent,
    newContent,
    "original",
    "modified",
  );
  return patch;
}
