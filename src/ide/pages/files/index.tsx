import type React from "react";
import { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  RefreshCw,
  MoreHorizontal,
  ListCollapse,
  X,
  Check,
} from "lucide-react";
import type { FSNode } from "@/ide/filesystem";
import type { FSDirectory } from "@/ide/filesystem";
import { useFileSystem } from "@/ide/filesystem";
import { FileIcon } from "@/components/file-icon";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import { addOpenFile } from "@/ide/editor";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getWebContainer } from "@/components/container";
interface FileTreeNodeProps {
  name: string;
  level: number;
  fullPath: string;
  node: FSNode;
}

const sortedEntries = (files: FSDirectory) => {
  return Object.entries(files.directory).sort((a, b) => {
    const aIsDirectory = "directory" in a[1];
    const bIsDirectory = "directory" in b[1];
    if (aIsDirectory !== bIsDirectory) {
      // prioritize directories
      return aIsDirectory ? -1 : 1;
    }
    return a[0].localeCompare(b[0]); // sort alphabetically
  });
};
export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  name,
  node,
  level,
  fullPath,
}) => {
  const [isOpen, setIsOpen] = useState((node as FSDirectory).open || false);
  const { setFiles, files } = useFileSystem();

  // Sync local state with node's open property when it changes
  useEffect(() => {
    if ("directory" in node) {
      setIsOpen(node.open || false);
    }
  }, [node]);

  const click = () => {
    console.log(" -> node", node);
    if ("directory" in node) {
      setIsOpen(!isOpen);
      console.log("toggle", fullPath);
      let current = files;
      const parts = fullPath.split("/").filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        if (i === parts.length - 1) {
          const targetNode = current.directory[part];
          if (targetNode && "directory" in targetNode) {
            current.directory[part] = {
              ...targetNode,
              open: !isOpen,
            };
          }
        } else {
          current = current.directory[part] as FSDirectory;
        }
      }
      setFiles({ ...files });
    } else if ("symlink" in node) {
      const target = node.symlink.target;
      const targetPath = `${fullPath}/${target}`; // TODO: make sure this works
      if (fileSystem.canOpenFile(targetPath)) {
        addOpenFile(targetPath);
      }
    } else if ("file" in node) {
      if (!node.file.isBinary) {
        addOpenFile(fullPath);
      } else {
        toast.error(
          <>
            <span className="font-mono">
              This file is a binary file. Are you sure you want to open it?
            </span>
            <Button
              onClick={() => {
                addOpenFile(fullPath, true);
                toast.dismiss();
              }}
            >
              Open
            </Button>
            <Button
              onClick={() => {
                toast.dismiss();
              }}
            >
              Cancel
            </Button>
          </>,
        );
        console.log(" -> binary file", fullPath);
      }
    }
  };

  const getIcon = () => {
    return <FileIcon node={node} name={name} />;
  };
  const getChevron = () => {
    if ("directory" in node) {
      return isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />;
    }
    return <span className="w-4" />;
  };
  const sorted = "directory" in node ? sortedEntries(node) : [];

  return (
    <div className="group/tree relative">
      {level > 0 && (
        <div
          className="absolute z-10 w-px bg-transparent transition-colors group-hover/tree:bg-[#606060]"
          style={{
            // this is the line
            left: `${level * 8 + 4}px`,
            top: 0,
            bottom: 0,
          }}
        />
      )}
      <div
        className={
          "relative flex cursor-pointer items-center px-2 py-1 hover:bg-[#2A2D2E]"
        }
        style={{
          paddingLeft: `${level * 8 + 12}px`,
        }}
        onClick={click}
      >
        {getChevron()}
        {getIcon()}
        <span className="ml-1 truncate text-xs">{name}</span>
      </div>
      {isOpen && "directory" in node && (
        <div>
          {sorted.map(([childName, childNode]) => (
            <FileTreeNode
              key={childName}
              name={childName}
              node={childNode}
              level={level + 1}
              fullPath={`${fullPath}/${childName}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FilesPage = () => {
  const { files, setFiles } = useFileSystem();
  const sorted = sortedEntries(files);
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(
    null,
  );
  const [newItemName, setNewItemName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingType]);

  const handleCreateFile = () => {
    setCreatingType("file");
    setNewItemName("");
  };

  const handleCreateFolder = () => {
    setCreatingType("folder");
    setNewItemName("");
  };

  const handleConfirmCreate = async () => {
    if (!newItemName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    const path = `/${newItemName}`;

    try {
      const container = getWebContainer();
      if (!container || container.status !== "ready") {
        toast.error("WebContainer not ready");
        return;
      }

      if (creatingType === "file") {
        await container.webContainer?.fs.writeFile(path, "");
        toast.success(`File "${newItemName}" created`);
        // Open the newly created file
        setTimeout(() => addOpenFile(path), 100);
      } else if (creatingType === "folder") {
        await container.webContainer?.fs.mkdir(path, { recursive: false });
        toast.success(`Folder "${newItemName}" created`);
      }
    } catch (error) {
      console.error("Error creating item:", error);
      toast.error(
        `Failed to create ${creatingType}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }

    setCreatingType(null);
    setNewItemName("");
  };

  const handleCancelCreate = () => {
    setCreatingType(null);
    setNewItemName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirmCreate();
    } else if (e.key === "Escape") {
      handleCancelCreate();
    }
  };

  const collapseAll = () => {
    const collapseRecursive = (node: FSNode): FSNode => {
      if ("directory" in node) {
        const collapsedDirectory: FSDirectory = {
          directory: {},
          open: false,
        };

        // Recursively collapse all subdirectories
        for (const [key, childNode] of Object.entries(node.directory)) {
          collapsedDirectory.directory[key] = collapseRecursive(childNode);
        }

        return collapsedDirectory;
      }
      return node;
    };

    const newFiles = collapseRecursive(files) as FSDirectory;
    setFiles(newFiles);
  };

  return (
    <div className="group h-full overflow-auto bg-sidebar p-2 font-mono text-sm">
      <div className="group/header mb-2 flex items-center justify-between">
        <h2 className="font-sans text-xs font-semibold uppercase text-muted-foreground">
          Explorer
        </h2>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/header:opacity-100">
          <button
            type="button"
            className="rounded p-1 transition-colors hover:bg-[#2A2D2E]"
            title="New File"
            onClick={handleCreateFile}
          >
            <FilePlus size={16} className="text-muted-foreground" />
          </button>
          <button
            type="button"
            className="rounded p-1 transition-colors hover:bg-[#2A2D2E]"
            title="New Folder"
            onClick={handleCreateFolder}
          >
            <FolderPlus size={16} className="text-muted-foreground" />
          </button>
          <button
            type="button"
            className="rounded p-1 transition-colors hover:bg-[#2A2D2E]"
            title="Collapse All"
            onClick={collapseAll}
          >
            <ListCollapse size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {creatingType && (
        <div className="mb-2 flex items-center gap-1 rounded bg-[#2A2D2E] px-2 py-1">
          <FileIcon
            node={
              creatingType === "folder"
                ? { directory: {}, open: false }
                : { file: { size: 0, isBinary: false } }
            }
            name={newItemName || "untitled"}
          />
          <input
            ref={inputRef}
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              creatingType === "file" ? "filename.ext" : "foldername"
            }
            className="flex-1 border-none bg-transparent px-1 text-xs outline-none"
          />
          <button
            type="button"
            className="rounded p-0.5 transition-colors hover:bg-[#3A3D3E]"
            onClick={handleConfirmCreate}
            title="Confirm"
          >
            <Check size={14} className="text-green-500" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 transition-colors hover:bg-[#3A3D3E]"
            onClick={handleCancelCreate}
            title="Cancel"
          >
            <X size={14} className="text-red-500" />
          </button>
        </div>
      )}

      <ScrollArea className="h-[93vh]">
        <div className="min-w-0">
          {sorted.map(([name, node]) => (
            <FileTreeNode
              key={name}
              name={name}
              node={node}
              level={0}
              fullPath={`/${name}`}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
