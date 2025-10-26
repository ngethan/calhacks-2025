import * as TabsPrimitive from "@radix-ui/react-tabs"
import { X } from "lucide-react"
import { FileIcon } from "@/components/file-icon";
import { useEditorState } from "@/ide/editor";
import { useMemo } from "react";

export const EditorTab = ({ path, index, windowIndex, showFullPath }: { path: string, index: number, windowIndex: number, showFullPath?: boolean }) => {
  const removeTabWithPath = useEditorState((state) => state.removeTabWithPath);
  const { name, internal } = useMemo(() => {
    // if (path.startsWith("internal:")) {
    //   return { name: path.substring(path.lastIndexOf(':') + 1), internal: true };
    // }
    if (showFullPath) {
      return { name: path, internal: false };
    }
    return { name: path.substring(path.lastIndexOf('/') + 1), internal: false };
  }, [path, showFullPath]);

  return (
    <TabsPrimitive.Trigger key={path} value={index + ""} className="p-2 flex flex-row gap-2 data-[state=active]:bg-editor-background hover:bg-sidebar-accent bg-sidebar border-t border-x border-sidebar-accent place-items-center max-w-[250px] min-w-0">
      <FileIcon node={{ file: { size: 0, isBinary: false } }} name={name} className="shrink-0" />
      <span className="truncate flex-1 min-w-0 text-sm" title={path}>
        {name}
      </span>
      <div onClick={(e) => {
        e.stopPropagation();
        console.log("close");
        removeTabWithPath(path, windowIndex);
      }} className="hover:bg-sidebar-accent rounded-md p-1 shrink-0">
        <X className="w-4 h-4 hover:text-red-500" />
      </div>
    </TabsPrimitive.Trigger>
  )
}

