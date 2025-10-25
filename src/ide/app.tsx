"use client";

import { WebContainerProvider } from "@/components/container";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import XTermConsole from "@/components/xterm-console";
import { IFrame } from "@/ide/iframe";
import { IDESidebar } from "@/ide/sidebar";
import { IDESidebarContent } from "@/ide/sidebar/content";
import { IDEEditor } from "@/ide/editor";

const App = () => {
  return (
    <WebContainerProvider>
      <SidebarProvider open={false}>
        <IDESidebar />
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={15}>
            <IDESidebarContent />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>
            <ResizablePanelGroup direction="vertical" className="h-full min-h-screen max-h-screen">
              <ResizablePanel>
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel collapsible>
                    <IDEEditor />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel collapsible defaultSize={0}>
                    <IFrame />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <XTermConsole />
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarProvider>
    </WebContainerProvider>
  )
}
export default App;