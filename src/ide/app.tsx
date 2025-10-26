"use client";

import { useState } from "react";
import { WebContainerProvider } from "@/components/container";
import { IFrameProvider } from "@/ide/iframe-context";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import XTermConsole from "@/components/xterm-console";
import { IDESidebar } from "@/ide/sidebar";
import { IDESidebarContent } from "@/ide/sidebar/content";
import { IDEEditor } from "@/ide/editor";
import { Chat } from "@/ide/chat";

const App = () => {
  const [showChat, setShowChat] = useState(true);

  return (
    <WebContainerProvider>
      <IFrameProvider>
        <SidebarProvider open={false}>
          <IDESidebar />
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={15} minSize={15} maxSize={30} collapsible>
              <IDESidebarContent />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel>
              <div className="relative h-full min-h-screen max-h-screen pb-10">
                <ResizablePanelGroup direction="horizontal" className="absolute inset-0">
                  <ResizablePanel collapsible>
                    <ResizablePanelGroup direction="horizontal">
                      <ResizablePanel collapsible>
                        <ResizablePanelGroup direction="vertical">
                          <ResizablePanel>
                            <IDEEditor onOpenChat={() => setShowChat(true)} showChat={showChat} />
                          </ResizablePanel>
                          <ResizableHandle withHandle />
                          <XTermConsole />
                        </ResizablePanelGroup>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </ResizablePanel>
                  {showChat && (
                    <>
                      <ResizableHandle withHandle />
                      <ResizablePanel collapsible defaultSize={25} minSize={20}>
                        <Chat onClose={() => setShowChat(false)} />
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </SidebarProvider>
      </IFrameProvider>
    </WebContainerProvider>
  )
}
export default App;