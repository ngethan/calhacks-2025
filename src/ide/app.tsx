"use client";

import { WebContainerProvider } from "@/components/container";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarProvider } from "@/components/ui/sidebar";
import XTermConsole from "@/components/xterm-console";
import { Chat } from "@/ide/chat";
import { IDEEditor, useEditorState } from "@/ide/editor";
import { IFrame } from "@/ide/iframe";
import { IDESidebar } from "@/ide/sidebar";
import { IDESidebarContent } from "@/ide/sidebar/content";
import { Eye, Github, Menu, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IFrameProvider } from "./iframe-context";

const App = () => {
  const [showChat, setShowChat] = useState(true);
  const [chatWidth, setChatWidth] = useState(25);
  const editorState = useEditorState();

  const handleExportToGithub = () => {
    toast.info("Connecting to GitHub...");
    window.location.href = "/api/github/oauth";
  };

  return (
    <WebContainerProvider>
      <div className="flex h-screen flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-border border-b bg-sidebar px-4 py-2">
          <div className="flex gap-2 items-center">
            <img
              src="/logo.png"
              alt="Aligned Logo"
              className="h-6 w-6 object-contain"
            />
            <p className="font-mono">vibecheck</p>
          </div>
          <p>Recipe App (10:23 left)</p>
          <div className="flex items-center gap-1">
            {/* Mobile menu - shows on screens smaller than lg */}
            <div className="flex gap-1 lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      editorState.addTabToActiveWindow("internal:preview");
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Open Preview
                  </DropdownMenuItem>
                  {!showChat && (
                    <DropdownMenuItem onClick={() => setShowChat(true)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Open AI Chat
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleExportToGithub}>
                    <Github className="mr-2 h-4 w-4" />
                    Export to GitHub
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowChat(true)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Submit
              </Button>
            </div>

            {/* Desktop menu - shows on lg screens and larger */}
            <div className="hidden gap-1 lg:flex">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  editorState.addTabToActiveWindow("internal:preview");
                }}
              >
                <Eye className="h-4 w-4" />
                Open Preview
              </Button>
              {!showChat && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChat(true)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Open AI Chat
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportToGithub}
                className="gap-2"
              >
                <Github className="h-4 w-4" />
                Export to GitHub
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowChat(true)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Submit
              </Button>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <SidebarProvider open={false}>
            <IDESidebar />
            <IFrameProvider>
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={15} minSize={12} maxSize={30} collapsible>
                  <IDESidebarContent />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel>
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel>
                      <ResizablePanelGroup
                        direction="vertical"
                        className="h-full max-h-screen"
                      >
                        <ResizablePanel>
                          <ResizablePanelGroup direction="horizontal">
                            <ResizablePanel collapsible>
                              <IDEEditor />
                            </ResizablePanel>
                          </ResizablePanelGroup>
                        </ResizablePanel>
                        <ResizableHandle />
                        <XTermConsole />
                      </ResizablePanelGroup>
                    </ResizablePanel>
                    {showChat && (
                      <>
                        <ResizableHandle />
                        <ResizablePanel
                          defaultSize={chatWidth}
                          minSize={20}
                          maxSize={40}
                          onResize={(size) => setChatWidth(size)}
                        >
                          <Chat onClose={() => setShowChat(false)} />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </ResizablePanel>
              </ResizablePanelGroup>
            </IFrameProvider>
          </SidebarProvider>
        </div>
      </div>
    </WebContainerProvider>
  );
};
export default App;
