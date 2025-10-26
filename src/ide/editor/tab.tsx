import { FileIcon } from "@/components/file-icon";
import { useEditorState } from "@/ide/editor";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import { useMemo } from "react";

export const EditorTab = ({
  path,
  index,
  windowIndex,
  showFullPath,
}: {
  path: string;
  index: number;
  windowIndex: number;
  showFullPath?: boolean;
}) => {
  const removeTabWithPath = useEditorState((state) => state.removeTabWithPath);
  const { name } = useMemo(() => {
    if (path.startsWith("internal:")) {
      let friendlyName = undefined;
      if (path.substring(path.lastIndexOf(":") + 1) === "preview") {
        friendlyName = "Preview";
      }
      return {
        name: friendlyName || path.substring(path.lastIndexOf(":") + 1),
        internal: true,
      };
    }
    if (showFullPath) {
      return { name: path, internal: false };
    }
    return { name: path.substring(path.lastIndexOf("/") + 1), internal: false };
  }, [path, showFullPath]);

  return (
    <TabsPrimitive.Trigger
      key={path}
      value={`${index}`}
      className="flex min-w-0 max-w-[250px] flex-row place-items-center gap-2 border-sidebar-accent border-x border-t bg-sidebar p-2 hover:bg-sidebar-accent data-[state=active]:bg-editor-background"
    >
      <FileIcon
        node={{ file: { size: 0, isBinary: false } }}
        name={name}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate" title={path}>
        {name}
      </span>
      <div
        onClick={(e) => {
          e.stopPropagation();
          console.log("close");
          removeTabWithPath(path, windowIndex);
        }}
        className="shrink-0 rounded-md p-1 hover:bg-sidebar-accent"
      >
        <X className="h-4 w-4 hover:text-red-500" />
      </div>
    </TabsPrimitive.Trigger>
  );
};
