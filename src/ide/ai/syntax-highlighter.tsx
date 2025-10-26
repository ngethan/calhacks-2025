"use client";

import { codeToHtml, codeToTokensBase, type BundledLanguage } from "shiki";
import { useEffect, useState } from "react";

type SyntaxHighlightedCodeProps = {
  code: string;
  language?: string;
  filePath?: string;
};

type SyntaxHighlightedLineProps = {
  code: string;
  language?: string;
  filePath?: string;
  className?: string;
};

// Map file extensions to language identifiers
function getLanguageFromPath(path: string): BundledLanguage {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, BundledLanguage> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    sql: "sql",
    md: "markdown",
    txt: "typescript",
  };
  return langMap[ext || ""] || "typescript";
}

export function SyntaxHighlightedCode({
  code,
  language,
  filePath,
}: SyntaxHighlightedCodeProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const lang: BundledLanguage =
      (language as BundledLanguage) ||
      (filePath ? getLanguageFromPath(filePath) : "plaintext");

    codeToHtml(code, {
      lang,
      theme: "github-dark",
    })
      .then((result: string) => {
        setHtml(result);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        console.error("Error highlighting code:", error);
        setIsLoading(false);
      });
  }, [code, language, filePath]);

  if (isLoading) {
    return (
      <pre className="mx-3 mb-3 max-h-[300px] overflow-x-auto rounded bg-background p-2 text-xs">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="mx-3 mb-3 max-h-[300px] overflow-x-auto rounded text-xs [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-2"
      // eslint-disable-next-line react/no-danger
      // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function SyntaxHighlightedLine({
  code,
  language,
  filePath,
  className = "",
}: SyntaxHighlightedLineProps) {
  const [tokens, setTokens] = useState<{ content: string; color?: string }[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const lang: BundledLanguage =
      (language as BundledLanguage) ||
      (filePath ? getLanguageFromPath(filePath) : "plaintext");

    codeToTokensBase(code, {
      lang,
      theme: "github-dark",
    })
      .then((result) => {
        const lineTokens = result[0] || [];
        setTokens(
          lineTokens.map((token) => ({
            content: token.content,
            color: token.color,
          }))
        );
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        console.error("Error highlighting line:", error);
        setTokens([{ content: code }]);
        setIsLoading(false);
      });
  }, [code, language, filePath]);

  if (isLoading) {
    return <span className={className}>{code}</span>;
  }

  return (
    <span className={className}>
      {tokens.map((token, idx) => (
        <span key={idx} style={{ color: token.color }}>
          {token.content}
        </span>
      ))}
    </span>
  );
}
