"use client";

import { TabsContent } from "@/components/ui/tabs";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import { useDebouncedCallback } from "@/lib/utils/debounce-hooks";
import { Editor, type Monaco, loader } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";

// Initialize Monaco theme only on client side
if (typeof window !== "undefined") {
  loader.init().then((monaco) => {
    monaco.editor.defineTheme("runway-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#282c34",
        "editor.foreground": "#abb2bf",
        "editorLineNumber.foreground": "#5c6370",
        "editorLineNumber.activeForeground": "#abb2bf",
        "editorCursor.foreground": "#528bff",
        "editor.selectionBackground": "#3e4451",
        "editor.inactiveSelectionBackground": "#3a3f4b",
      },
    });
  });
}

type MonacoEditor = Parameters<
  NonNullable<Parameters<typeof Editor>[0]["onMount"]>
>[0];

export const EditorTabContent = ({
  tab,
  path,
  index,
}: {
  tab: string;
  path: string;
  index: number;
}) => {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const isUpdatingFromExternal = useRef(false);

  const debouncedWrite = useDebouncedCallback(
    async (filePath: string, content: string) => {
      console.log("[!] -> debounced write", filePath);
      await fileSystem.writeFileAsync(filePath, content);
    },
    300,
  );

  const onChange = useCallback(
    (value: string | undefined) => {
      // Ignore changes that come from external file updates
      if (isUpdatingFromExternal.current) {
        return;
      }
      debouncedWrite(path, value || "");
    },
    [path, debouncedWrite],
  );

  useEffect(() => {
    // Subscribe to file system changes for this specific file
    const unsubscribe = fileSystem.subscribeToFileChange(
      path,
      (newContent: string) => {
        if (editorRef.current && monacoRef.current) {
          const currentModel = editorRef.current.getModel();
          if (currentModel) {
            const currentValue = currentModel.getValue();
            // Only update if the content is different
            if (currentValue !== newContent) {
              console.log(
                `[!] -> External change detected for ${path}, updating editor`,
              );
              isUpdatingFromExternal.current = true;

              // Preserve cursor position and scroll position
              const position = editorRef.current.getPosition();
              const scrollTop = editorRef.current.getScrollTop();

              // Update the model value
              currentModel.setValue(newContent);

              // Restore cursor and scroll position
              if (position) {
                editorRef.current.setPosition(position);
              }
              editorRef.current.setScrollTop(scrollTop);

              isUpdatingFromExternal.current = false;
            }
          }
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [path]);

  const theme = useTheme();

  return (
    <TabsContent key={tab} value={`${index}`} className="mt-0">
      <Editor
        height="90vh"
        path={tab}
        defaultValue={fileSystem.getEditableFileContent(tab, true) || ""}
        theme={theme.theme === "dark" ? "vs-dark" : "vs-light"}
        onMount={(editor, monaco) => {
          monaco.editor.setTheme("runway-dark");
          editorRef.current = editor;
          monacoRef.current = monaco;

          // Disable TypeScript diagnostics
          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
            noSuggestionDiagnostics: true,
          });

          // Disable JavaScript diagnostics
          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
            noSuggestionDiagnostics: true,
          });
        }}
        onChange={onChange}
      />
    </TabsContent>
  );
};
