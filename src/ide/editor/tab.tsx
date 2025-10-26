import { FileIcon } from "@/components/file-icon";
import { useEditorState } from "@/ide/editor";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import { useMemo } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export const EditorTab = ({
  path,
  index,
  windowIndex,
  showFullPath,
  totalTabs,
}: {
  path: string;
  index: number;
  windowIndex: number;
  showFullPath?: boolean;
  totalTabs: number;
}) => {
  const removeTabWithPath = useEditorState((state) => state.removeTabWithPath);
  const closeOtherTabs = useEditorState((state) => state.closeOtherTabs);
  const closeAllTabs = useEditorState((state) => state.closeAllTabs);
  const closeTabsToRight = useEditorState((state) => state.closeTabsToRight);
  
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

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeTabWithPath(path, windowIndex);
  };

  const handleCloseOthers = () => {
    closeOtherTabs(windowIndex, index);
  };

  const handleCloseAll = () => {
    closeAllTabs(windowIndex);
  };

  const handleCloseToRight = () => {
    closeTabsToRight(windowIndex, index);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TabsPrimitive.Trigger
          key={path}
          value={`${index}`}
          className="flex min-w-0 max-w-[250px] flex-row place-items-center gap-2 border-x border-t border-sidebar-accent bg-sidebar p-2 hover:bg-sidebar-accent data-[state=active]:bg-editor-background"
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
            onClick={handleClose}
            className="shrink-0 rounded-md p-1 hover:bg-sidebar-accent"
          >
            <X className="h-4 w-4 hover:text-red-500" />
          </div>
        </TabsPrimitive.Trigger>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleClose}>
          Close
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={handleCloseOthers}
          disabled={totalTabs <= 1}
        >
          Close Others
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCloseAll}>
          Close All
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={handleCloseToRight}
          disabled={index >= totalTabs - 1}
        >
          Close to the Right
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
