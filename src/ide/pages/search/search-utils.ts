import type { FSDirectory } from "@/ide/filesystem";
import { fileSystem } from "@/ide/filesystem/zen-fs";

export type SearchResult = {
  path: string;
  name: string;
  matches: SearchMatch[];
};

export type SearchMatch = {
  lineNumber: number;
  lineContent: string;
  columnStart: number;
  columnEnd: number;
};

/**
 * Search for content across all files in the file system
 */
export async function searchInFiles(
  directory: FSDirectory,
  searchQuery: string,
  options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    useRegex?: boolean;
    includePattern?: string;
    excludePattern?: string;
  } = {},
): Promise<SearchResult[]> {
  if (!searchQuery) return [];

  const {
    caseSensitive = false,
    wholeWord = false,
    useRegex = false,
    includePattern,
    excludePattern,
  } = options;

  const results: SearchResult[] = [];
  const filePaths = getAllFilePathsFromDirectory(directory);

  // Create regex pattern for searching
  let searchPattern: RegExp;
  try {
    if (useRegex) {
      searchPattern = new RegExp(
        searchQuery,
        caseSensitive ? "g" : "gi",
      );
    } else {
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
      searchPattern = new RegExp(pattern, caseSensitive ? "g" : "gi");
    }
  } catch (error) {
    console.error("Invalid regex pattern:", error);
    return [];
  }

  // Filter files based on include/exclude patterns
  const filteredPaths = filePaths.filter((path) => {
    if (includePattern) {
      const includeRegex = globToRegex(includePattern);
      if (!includeRegex.test(path)) return false;
    }
    if (excludePattern) {
      const excludeRegex = globToRegex(excludePattern);
      if (excludeRegex.test(path)) return false;
    }
    return true;
  });

  // Search through each file
  for (const path of filteredPaths) {
    const content = fileSystem.getEditableFileContent(path);
    if (content === false || content === null) continue;

    const matches = searchInFileContent(content, searchPattern);
    if (matches.length > 0) {
      const name = path.split("/").pop() || path;
      results.push({ path, name, matches });
    }
  }

  return results;
}

/**
 * Search within a single file's content
 */
function searchInFileContent(
  content: string,
  pattern: RegExp,
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Reset regex lastIndex for each line
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      matches.push({
        lineNumber: i + 1,
        lineContent: line,
        columnStart: match.index,
        columnEnd: match.index + match[0].length,
      });

      // Prevent infinite loop on zero-width matches
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  }

  return matches;
}

/**
 * Get all file paths from directory recursively
 */
function getAllFilePathsFromDirectory(
  directory: FSDirectory,
  currentPath = "",
): string[] {
  const paths: string[] = [];

  for (const [name, node] of Object.entries(directory.directory)) {
    const fullPath = currentPath ? `${currentPath}/${name}` : `/${name}`;

    if ("file" in node) {
      if (!node.file.isBinary) {
        paths.push(fullPath);
      }
    } else if ("directory" in node) {
      paths.push(...getAllFilePathsFromDirectory(node, fullPath));
    }
  }

  return paths;
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}
