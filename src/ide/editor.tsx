import { useWebContainer } from "@/components/container";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { EditorTab } from "@/ide/editor/tab";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Eye, Github, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { TabContent } from "@/ide/editor/tab-content";

type EditorWindow = {
  tabs: { path: string; content: string }[];
  activeTab: number;
};

type EditorState = {
  windows: EditorWindow[];
  activeWindow: number | null;

  addWindow: (tabs: string[]) => void;
  setActiveWindow: (id: number) => void;
  removeTabWithPath: (path: string, window: number) => void;
  addTabToWindow: (window: number, path: string) => void;
  addTabToActiveWindow: (path: string) => void;
  setActiveTab: (window: number, tab: number) => void;
};

export const useEditorState = create<EditorState>()(
  // persist(
  immer((set) => ({
    windows: [] as EditorWindow[],
    activeWindow: null as number | null,

    addWindow: (tabs: string[]) => {
      set((state) => {
        state.windows.push({
          tabs: tabs.map((path) => ({ path, content: "" })),
          activeTab: 0,
        });
      });
    },
    setActiveWindow: (id: number) => {
      set((state) => {
        state.activeWindow = id;
      });
    },
    removeTabWithPath: (path: string, window: number) => {
      set((state) => {
        const updateWindow = (w: EditorWindow) => {
          w.tabs = w.tabs.filter((tab) => tab.path !== path);
          if (w.tabs.length > 0 && w.activeTab >= w.tabs.length) {
            w.activeTab = w.tabs.length - 1;
          }
        };

        if (window === -1) {
          // all windows
          console.log("removing tab", path, "from all windows");
          state.windows.forEach(updateWindow);
        } else {
          const w = state.windows[window];
          if (w) {
            // just this window
            console.log("removing tab", path, "from window", window);
            updateWindow(w);
          }
        }
      });
    },
    setActiveTab: (window: number, tab: number) => {
      set((state) => {
        const w = state.windows[window];
        if (w) {
          w.activeTab = tab;
        }
      });
    },
    addTabToWindow: (window: number, path: string) => {
      set((state) => {
        const w = state.windows[window];
        if (w) {
          const existingTabIndex = w.tabs.findIndex((tab) => tab.path === path);
          if (existingTabIndex >= 0) {
            w.activeTab = existingTabIndex;
          } else {
            w.tabs.push({ path, content: "" });
          }
        }
      });
    },
    addTabToActiveWindow: (path: string) => {
      set((state) => {
        if (state.activeWindow === null) {
          state.windows.push({
            tabs: [{ path, content: "" }],
            activeTab: 0,
          });
          state.activeWindow = state.windows.length - 1;
        } else {
          const w = state.windows[state.activeWindow];
          if (w) {
            const existingTabIndex = w.tabs.findIndex(
              (tab) => tab.path === path
            );
            if (existingTabIndex >= 0) {
              w.activeTab = existingTabIndex;
              console.log(
                "tab already exists, setting active tab to",
                existingTabIndex
              );
            } else {
              w.tabs.push({ path, content: "" });
              w.activeTab = w.tabs.length - 1;
              console.log("tab does not exist, adding it");
            }
          }
        }
      });
    },
  }))
  // {
  //   name: "runway-editor-state",
  //   storage: createJSONStorage(() => localStorage),
  //   partialize: (state) => ({
  //     windows: state.windows.map((window) => ({
  //       id: window.id,
  //       file: window.file,
  //     })),
  //     activeWindow: state.activeWindow,
  //   }),
  //   onRehydrateStorage: (state) => {
  //     console.log('onRehydrateStorage', state);

  //   },
  // }
  // )
);

export const addOpenFile = (path: string, force: boolean = false) => {
  console.log("Opening file:", path);
  if (!fileSystem.canOpenFile(path, force)) {
    console.error("[x] file is not editable:", path);
    return;
  }
  // either add a new window if one doesnt already exist, or add the file to the existing window
  useEditorState.getState().addTabToActiveWindow(path);
  console.log("[!] -> state", useEditorState.getState());
};

type IDEEditorProps = {
  onOpenChat?: () => void;
  showChat?: boolean;
};

export const IDEEditor = ({ onOpenChat, showChat }: IDEEditorProps) => {
  const container = useWebContainer();
  const editorState = useEditorState();

  const handleExportToGithub = () => {
    toast.info("Connecting to GitHub...");
    window.location.href = "/api/github/oauth";
  };

  // const activeWindow = useMemo(() => editorState.windows.find((window) => window.id === editorState.activeWindow), [editorState.windows, editorState.activeWindow]);

  if (!container || container.status !== "ready") {
    // TODO: just "freeze" the editor until the container is ready
    return <></>;
  }
  return (
    <div className="flex flex-col h-full">
      <div className="bg-sidebar border-b border-border px-2 py-1 flex items-center justify-end gap-2">
        {!showChat && onOpenChat && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenChat}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Open AI Chat
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          editorState.addTabToActiveWindow("internal:preview")
        }}>
          <Eye className="h-4 w-4" />
          Open Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportToGithub}
          className="gap-2"
        >
          <Github className="h-4 w-4" />
          Export to GitHub
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {editorState.windows.map((w, i) => {
          // TODO: this only works for one window atm
          return (
            <TabsPrimitive.Root
              value={w.activeTab + ""}
              onValueChange={(value) =>
                editorState.setActiveTab(i, parseInt(value))
              }
              className="w-full h-full"
              key={i}
            >
              <TabsPrimitive.List className="bg-sidebar flex flex-row overflow-hidden">
                <ScrollArea className="w-full">
                  <div className="flex flex-row flex-nowrap">
                    {w.tabs.map((tab, j) => {
                      // Check if there are duplicate file names
                      const fileName = tab.path.substring(tab.path.lastIndexOf('/') + 1);
                      const hasDuplicate = w.tabs.some((t, idx) => {
                        if (idx === j) return false;
                        const otherFileName = t.path.substring(t.path.lastIndexOf('/') + 1);
                        return fileName === otherFileName;
                      });
                      
                      return (
                        <EditorTab
                          key={tab.path}
                          path={tab.path}
                          index={j}
                          windowIndex={i}
                          showFullPath={hasDuplicate}
                        />
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" className="h-2" />
                </ScrollArea>
              </TabsPrimitive.List>
              {w.tabs.map((tab, j) => {
                return (
                  <TabContent
                    key={tab.path}
                    tab={tab.path}
                    path={tab.path}
                    index={j}
                  />
                );
              })}
            </TabsPrimitive.Root>
          );
        })}
      </div>
    </div>
  );
};
