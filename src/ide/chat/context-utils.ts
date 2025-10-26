import type { FSDirectory, FSNode } from "@/ide/filesystem";

export type FileContext = {
  path: string;
  name: string;
};

/**
 * Recursively get all file paths from the file system
 */
export function getAllFilePaths(
  directory: FSDirectory,
  currentPath = "",
): FileContext[] {
  const files: FileContext[] = [];

  for (const [name, node] of Object.entries(directory.directory)) {
    const fullPath = currentPath ? `${currentPath}/${name}` : `/${name}`;

    if ("file" in node) {
      // It's a file
      if (!node.file.isBinary) {
        files.push({ path: fullPath, name });
      }
    } else if ("directory" in node) {
      // It's a directory - recurse
      files.push(...getAllFilePaths(node, fullPath));
    }
    // Skip symlinks for now
  }

  return files;
}

/**
 * Filter files based on search query
 */
export function filterFiles(
  files: FileContext[],
  query: string,
): FileContext[] {
  if (!query) return files;

  const lowerQuery = query.toLowerCase();
  return files
    .filter((file) => {
      const fileName = file.name.toLowerCase();
      const filePath = file.path.toLowerCase();
      return fileName.includes(lowerQuery) || filePath.includes(lowerQuery);
    })
    .sort((a, b) => {
      // Prioritize matches in file name over path
      const aNameMatch = a.name.toLowerCase().startsWith(lowerQuery);
      const bNameMatch = b.name.toLowerCase().startsWith(lowerQuery);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return a.path.localeCompare(b.path);
    });
}
