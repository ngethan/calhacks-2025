"use client";

import { TabsContent } from "@/components/ui/tabs";
import { fileSystem, subscribeToFileChanges } from "@/ide/filesystem/zen-fs";
import { Editor, loader } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";

loader.init().then((monaco) => {
  monaco.editor.defineTheme('runway-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    // set background to editor-background
    colors: {
      "editor.background": "#1f1f1f"
    }
  });
});
export const EditorTabContent = ({ tab, path, index }: { tab: string, path: string, index: number }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const isUpdatingFromExternalRef = useRef(false);
  
  const onChange = async (value: string | undefined) => {
    // Don't trigger writeFileAsync if the change came from an external update
    if (isUpdatingFromExternalRef.current) {
      return;
    }
    console.log("[!] -> onChange", value);
    await fileSystem.writeFileAsync(path, value || "");
  } /*useDebouncedCallback(async (value: string, path: string) => {
    await fileSystem.writeFileAsync(path, value);
  }, 300);*/
  
  const theme = useTheme();
  
  // Subscribe to external file changes
  useEffect(() => {
    const unsubscribe = subscribeToFileChanges(path, (changedPath, newContent) => {
      const editor = editorRef.current;
      if (!editor) return;
      
      const model = editor.getModel();
      if (!model) return;
      
      // Get current cursor position and scroll position
      const position = editor.getPosition();
      const scrollTop = editor.getScrollTop();
      
      // Check if the new content is different from current content
      const currentContent = model.getValue();
      if (currentContent === newContent) {
        return; // No change needed
      }
      
      // Set flag to prevent triggering onChange during external update
      isUpdatingFromExternalRef.current = true;
      
      // Update the model content
      model.setValue(newContent);
      
      // Restore cursor position if it's still valid
      if (position) {
        const lineCount = model.getLineCount();
        if (position.lineNumber <= lineCount) {
          editor.setPosition(position);
        }
      }
      
      // Restore scroll position
      editor.setScrollTop(scrollTop);
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isUpdatingFromExternalRef.current = false;
      }, 100);
      
      console.log(`[Monaco] Updated editor content for ${path} from external change`);
    });
    
    return unsubscribe;
  }, [path]);
  
  return (
    <TabsContent key={tab} value={index + ""} className="mt-0">
      <Editor
        height="90vh"
        path={tab}
        defaultValue={fileSystem.getEditableFileContent(tab, true) || ""}
        theme={theme.theme === 'dark' ? 'vs-dark' : 'vs-light'}
        onMount={(editor, monaco) => {
          monaco.editor.setTheme('runway-dark');
          editorRef.current = editor;
        }}
        onChange={onChange}
      />
    </TabsContent>
  )
}