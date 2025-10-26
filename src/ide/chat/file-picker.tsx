"use client";

import { FileIcon } from "@/components/file-icon";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileSystem } from "@/ide/filesystem";
import { Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type FileContext,
  filterFiles,
  getAllFilePaths,
} from "./context-utils";

type FilePickerProps = {
  onSelect: (file: FileContext) => void;
  onClose: () => void;
  searchQuery: string;
  selectedFiles: Set<string>;
  currentFilePath?: string;
  position?: { top: number; left: number; width: number };
};

export function FilePicker({
  onSelect,
  onClose,
  selectedFiles,
  currentFilePath,
}: FilePickerProps) {
  const { files } = useFileSystem();
  const [allFiles, setAllFiles] = useState<FileContext[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileContext[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fileList = getAllFilePaths(files);
    setAllFiles(fileList);
    setFilteredFiles(filterFiles(fileList, searchQuery));
  }, [files, searchQuery]);

  // Auto-add current file when picker opens
  useEffect(() => {
    if (currentFilePath && !selectedFiles.has(currentFilePath)) {
      const currentFile = allFiles.find((f) => f.path === currentFilePath);
      if (currentFile) {
        onSelect(currentFile);
      }
    }
  }, [currentFilePath, allFiles, selectedFiles, onSelect]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    // Focus search input when opened
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredFiles.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          onSelect(filteredFiles[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredFiles, selectedIndex, onSelect, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    const selectedElement = containerRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`,
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-lg border border-border bg-background shadow-xl"
    >
      {/* Search Input */}
      <div className="border-border/50 border-b p-3">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="h-9 border-0 bg-background/50 pl-9 text-sm focus-visible:ring-1"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close file picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* File List */}
      {filteredFiles.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground text-sm">No files found</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[280px]">
          <div className="p-2">
            {filteredFiles.map((file, index) => {
              const isSelected = selectedFiles.has(file.path);
              const isHighlighted = index === selectedIndex;

              return (
                <div
                  key={file.path}
                  data-index={index}
                  className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                    isHighlighted ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                  onClick={() => onSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex-shrink-0">
                    <FileIcon
                      node={{ file: { size: 0, isBinary: false } }}
                      name={file.name}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground text-sm">
                      {file.name}
                    </div>
                    <div className="truncate font-mono text-muted-foreground/60 text-xs">
                      {file.path}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Footer hint */}
      <div className="border-border/50 border-t bg-muted/30 px-3 py-2">
        <p className="text-muted-foreground text-xs">
          ↑↓ to navigate · ⏎ to select · ⎋ to close
        </p>
      </div>
    </div>
  );
}
