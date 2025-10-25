import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { FSNode } from "@/ide/filesystem";
import type { FSDirectory } from "@/ide/filesystem";
import { useFileSystem } from "@/ide/filesystem";
import { FileIcon } from '@/components/file-icon';
import { fileSystem } from '@/ide/filesystem/zen-fs';
import { addOpenFile } from '@/ide/editor';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
interface FileTreeNodeProps {
  name: string;
  level: number;
  fullPath: string;
  node: FSNode;
}


const sortedEntries = (files: FSDirectory) => {
  return Object.entries(files.directory).sort((a, b) => {
    const aIsDirectory = 'directory' in a[1];
    const bIsDirectory = 'directory' in b[1];
    if (aIsDirectory !== bIsDirectory) { // prioritize directories
      return aIsDirectory ? -1 : 1;
    }
    return a[0].localeCompare(b[0]); // sort alphabetically
  });
}
export const FileTreeNode: React.FC<FileTreeNodeProps> = ({ name, node, level, fullPath }) => {
  const [isOpen, setIsOpen] = useState((node as FSDirectory).open || false);
  const { setFiles, files } = useFileSystem();

  const click = () => {
    console.log(" -> node", node)
    if ('directory' in node) {
      setIsOpen(!isOpen);
      console.log("toggle", fullPath);
      let current = files;
      const parts = fullPath.split('/').filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        if (i === parts.length - 1) {
          const targetNode = current.directory[part];
          if (targetNode && 'directory' in targetNode) {
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
    } else if ('symlink' in node) {
      const target = node.symlink.target;
      const targetPath = `${fullPath}/${target}`; // TODO: make sure this works
      if (fileSystem.canOpenFile(targetPath)) {
        addOpenFile(targetPath);
      }
    } else if ('file' in node) {
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
          </>
        );
        console.log(" -> binary file", fullPath);
      }
    }
  };

  const getIcon = () => {
    return <FileIcon node={node} name={name} />
  };
  const getChevron = () => {
    if ('directory' in node) {
      return isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />;
    }
    return <span className="w-4" />;
  };
  const sorted = "directory" in node ? sortedEntries(node) : [];

  return (
    <div className="group/tree relative">
      {level > 0 && (
        <div className="absolute w-px bg-transparent group-hover/tree:bg-[#606060] transition-colors z-10"
          style={{ // this is the line
            left: `${level * 8 + 4}px`,
            top: 0,
            bottom: 0,
          }} />
      )}
      <div
        className={`flex items-center py-1 px-2 hover:bg-[#2A2D2E] cursor-pointer relative`}
        style={{
          paddingLeft: `${level * 8 + 12}px`,
        }}
        onClick={click}
      >
        {getChevron()}
        {getIcon()}
        <span className="ml-1 text-xs truncate">{name}</span>
      </div>
      {isOpen && 'directory' in node && (
        <div>
          {sorted.map(([childName, childNode]) => (
            <FileTreeNode key={childName} name={childName} node={childNode} level={level + 1} fullPath={`${fullPath}/${childName}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FilesPage = () => {
  const { files } = useFileSystem();
  const sorted = sortedEntries(files);

  return (
    <div className="group bg-sidebar p-2 font-mono text-sm h-full overflow-auto">
      <h2 className="font-semibold font-sans mb-2 text-xs uppercase text-muted-foreground">Explorer</h2>
      <ScrollArea className="h-[93vh]">
        <div className="min-w-0">
          {sorted.map(([name, node]) => (
            <FileTreeNode key={name} name={name} node={node} level={0} fullPath={"/" + name} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}