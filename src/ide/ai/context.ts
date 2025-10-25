/**
 * AI Context Management
 *
 * This module provides utilities for managing file context for AI chat.
 * Currently supports single file context. Future enhancements:
 * - Multi-file context with @ symbol mentions
 * - Workspace-wide file search
 * - Semantic code understanding
 */

export type FileContext = {
  path: string;
  content: string;
};

/**
 * Gets the current file context from the editor state.
 *
 * Future: Extend to support multiple files and @ mentions
 */
export function getCurrentFileContext(
  activeWindow: number | null,
  windows: Array<{ tabs: Array<{ path: string; content: string }>; activeTab: number }>,
  getFileContent: (path: string) => string | null
): FileContext | undefined {
  if (activeWindow === null) return undefined;
  const window = windows[activeWindow];
  if (!window) return undefined;
  const activeTab = window.tabs[window.activeTab];
  if (!activeTab) return undefined;

  return {
    path: activeTab.path,
    content: getFileContent(activeTab.path) || "",
  };
}

/**
 * Future: Parse @ mentions from user input to include multiple files
 * Example: "@file.ts explain this function"
 */
export function parseFileMentions(input: string): string[] {
  // TODO: Implement @ mention parsing
  // const mentions = input.match(/@[\w/.]+/g) || [];
  // return mentions.map(m => m.slice(1));
  return [];
}

/**
 * Future: Get context for multiple files
 */
export function getMultiFileContext(
  paths: string[],
  getFileContent: (path: string) => string | null
): FileContext[] {
  return paths
    .map((path) => ({
      path,
      content: getFileContent(path) || "",
    }))
    .filter((ctx) => ctx.content);
}
