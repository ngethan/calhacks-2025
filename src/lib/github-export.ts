import { fileSystem } from "@/ide/filesystem/zen-fs";
import zenFs from "@zenfs/core";

export interface FileToExport {
  path: string;
  content: string;
}

/**
 * Recursively collects all files from the filesystem, excluding node_modules and .git
 */
export async function collectFilesForExport(
  rootPath = "/",
): Promise<FileToExport[]> {
  const files: FileToExport[] = [];
  const ignoredDirs = ["node_modules", ".git", ".next", "dist", "build"];

  async function traverse(currentPath: string) {
    try {
      const entries = fileSystem.listFiles(currentPath);

      for (const entry of entries) {
        const fullPath =
          currentPath === "/" ? `/${entry}` : `${currentPath}/${entry}`;

        // Skip ignored directories
        if (ignoredDirs.includes(entry)) {
          continue;
        }

        const stats = zenFs.statSync(fullPath);

        if (stats.isDirectory()) {
          await traverse(fullPath);
        } else if (stats.isFile()) {
          // Check if file can be opened (not binary)
          if (fileSystem.canOpenFile(fullPath, false)) {
            const content = fileSystem.getEditableFileContent(fullPath, false);
            if (typeof content === "string") {
              // Remove leading slash for GitHub paths
              const relativePath = fullPath.startsWith("/")
                ? fullPath.substring(1)
                : fullPath;
              files.push({
                path: relativePath,
                content: content,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error traversing ${currentPath}:`, error);
    }
  }

  await traverse(rootPath);
  return files;
}

/**
 * Exports files to GitHub by creating a new repository
 */
export async function exportToGitHub(params: {
  repoName: string;
  repoDescription?: string;
  isPrivate?: boolean;
}): Promise<{
  success: boolean;
  repoUrl?: string;
  error?: string;
}> {
  try {
    // Collect all files
    const files = await collectFilesForExport();

    if (files.length === 0) {
      return {
        success: false,
        error: "No files found to export",
      };
    }

    // Call the API endpoint
    const response = await fetch("/api/github/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files,
        repoName: params.repoName,
        repoDescription: params.repoDescription,
        isPrivate: params.isPrivate,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to export to GitHub",
      };
    }

    return {
      success: true,
      repoUrl: data.repoUrl,
    };
  } catch (error) {
    console.error("Export to GitHub error:", error);
    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}
