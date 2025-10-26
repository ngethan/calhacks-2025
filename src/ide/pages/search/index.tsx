"use client";

import { FileIcon } from "@/components/file-icon";
import { useEditorState } from "@/ide/editor";
import { useFileSystem } from "@/ide/filesystem";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SearchMatch, SearchResult } from "./search-utils";
import { searchInFiles } from "./search-utils";

export const SearchPage = () => {
  const { files } = useFileSystem();
  const { addTabToActiveWindow } = useEditorState();

  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Search options
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [includePattern, setIncludePattern] = useState("");
  const [excludePattern, setExcludePattern] = useState("");

  // Perform search
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await searchInFiles(files, searchQuery, {
        caseSensitive,
        wholeWord,
        useRegex,
        includePattern: includePattern || undefined,
        excludePattern: excludePattern || undefined,
      });
      setResults(searchResults);
      // Auto-expand all results
      setExpandedFiles(new Set(searchResults.map((r) => r.path)));
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [
    searchQuery,
    files,
    caseSensitive,
    wholeWord,
    useRegex,
    includePattern,
    excludePattern,
  ]);

  // Search on query change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [performSearch]);

  const toggleFileExpanded = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleAllExpanded = () => {
    if (expandedFiles.size === results.length) {
      setExpandedFiles(new Set());
    } else {
      setExpandedFiles(new Set(results.map((r) => r.path)));
    }
  };

  const handleMatchClick = (path: string, _lineNumber: number) => {
    addTabToActiveWindow(path);
    // TODO: Navigate to specific line number once editor supports it
  };

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Search Input Section */}
      <div className="shrink-0 space-y-2 p-2.5 pb-3">
        {/* Main Search Input */}
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="h-[26px] w-full rounded border border-border/60 bg-[var(--vscode-input-background)] px-2 pr-20 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
          <div className="-translate-y-1/2 absolute top-1/2 right-1 flex gap-0.5">
            <ToggleButton
              active={caseSensitive}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Match Case (Alt+C)"
            >
              Aa
            </ToggleButton>
            <ToggleButton
              active={wholeWord}
              onClick={() => setWholeWord(!wholeWord)}
              title="Match Whole Word (Alt+W)"
            >
              <span className="font-sans">ab</span>
            </ToggleButton>
            <ToggleButton
              active={useRegex}
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression (Alt+R)"
            >
              .*
            </ToggleButton>
          </div>
        </div>

        {/* Replace Input */}
        <div className="relative">
          <input
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Replace"
            className="h-[26px] w-full rounded border border-border/60 bg-[var(--vscode-input-background)] px-2 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>

        {/* File Filters */}
        <div className="space-y-1.5">
          <input
            value={includePattern}
            onChange={(e) => setIncludePattern(e.target.value)}
            placeholder="files to include"
            className="h-[24px] w-full rounded border border-border/60 bg-[var(--vscode-input-background)] px-2 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
          <input
            value={excludePattern}
            onChange={(e) => setExcludePattern(e.target.value)}
            placeholder="files to exclude"
            className="h-[24px] w-full rounded border border-border/60 bg-[var(--vscode-input-background)] px-2 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {/* Results Section */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-sans text-[13px]">Searching...</span>
            </div>
          </div>
        ) : !searchQuery.trim() ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <p className="mb-1 font-sans text-[13px] text-muted-foreground">
                No results yet
              </p>
              <p className="font-sans text-[11px] text-muted-foreground/60">
                Type to search across files
              </p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <p className="mb-1 font-sans text-[13px] text-muted-foreground">
                No results found
              </p>
              <p className="font-mono text-[11px] text-muted-foreground/60">
                "{searchQuery}"
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Results Header */}
            <div className="flex items-center justify-between border-border/30 border-b bg-background px-2.5 py-1.5">
              <div className="font-sans text-[11px] text-muted-foreground">
                {totalMatches} {totalMatches === 1 ? "result" : "results"} in{" "}
                {results.length} {results.length === 1 ? "file" : "files"}
              </div>
              <button
                onClick={toggleAllExpanded}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronsUpDown className="h-3 w-3" />
                <span>
                  {expandedFiles.size === results.length
                    ? "Collapse All"
                    : "Expand All"}
                </span>
              </button>
            </div>

            {/* Results List */}
            <div>
              {results.map((result) => (
                <FileSearchResult
                  key={result.path}
                  result={result}
                  isExpanded={expandedFiles.has(result.path)}
                  onToggleExpand={() => toggleFileExpanded(result.path)}
                  onMatchClick={handleMatchClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

type FileSearchResultProps = {
  result: SearchResult;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMatchClick: (path: string, lineNumber: number) => void;
};

function FileSearchResult({
  result,
  isExpanded,
  onToggleExpand,
  onMatchClick,
}: FileSearchResultProps) {
  return (
    <div className="border-border/20 border-b">
      {/* File Header */}
      <div
        className="group flex cursor-pointer items-center gap-1.5 px-2.5 py-1 transition-colors hover:bg-accent/50"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <FileIcon
          node={{ file: { size: 0, isBinary: false } }}
          name={result.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate font-sans text-[13px] text-foreground">
              {result.name}
            </span>
            <span className="truncate font-mono text-[11px] text-muted-foreground/70">
              {result.path}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {result.matches.length}
        </span>
      </div>

      {/* Matches List */}
      {isExpanded && (
        <div className="bg-background/50">
          {result.matches.map((match, index) => (
            <MatchResult
              key={`${result.path}-${match.lineNumber}-${index}`}
              match={match}
              onClick={() => onMatchClick(result.path, match.lineNumber)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type MatchResultProps = {
  match: SearchMatch;
  onClick: () => void;
};

function MatchResult({ match, onClick }: MatchResultProps) {
  const highlightMatch = (text: string, start: number, end: number) => {
    return (
      <>
        <span className="text-muted-foreground/80">{text.slice(0, start)}</span>
        <span className="bg-[#9e6a03]/30 font-medium text-foreground">
          {text.slice(start, end)}
        </span>
        <span className="text-muted-foreground/80">{text.slice(end)}</span>
      </>
    );
  };

  // Calculate trimmed offsets
  const trimStart =
    match.lineContent.length - match.lineContent.trimStart().length;
  const adjustedStart = Math.max(0, match.columnStart - trimStart);
  const adjustedEnd = match.columnEnd - trimStart;

  return (
    <div
      className="group flex cursor-pointer items-start gap-2 py-0.5 pr-2 pl-7 transition-colors hover:bg-accent/40"
      onClick={onClick}
    >
      <span className="mt-[2px] w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground/60">
        {match.lineNumber}
      </span>
      <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-[12px] leading-[18px]">
        {highlightMatch(match.lineContent.trim(), adjustedStart, adjustedEnd)}
      </pre>
    </div>
  );
}

type ToggleButtonProps = {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
};

function ToggleButton({ active, onClick, title, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] transition-colors ${
        active
          ? "bg-blue-500/20 text-blue-400"
          : "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
