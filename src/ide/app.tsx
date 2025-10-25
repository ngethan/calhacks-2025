"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { MonacoEditor } from "@/ide/monaco/editor";

const App = () => {
  return (
    <SidebarProvider open={false}>
      <MonacoEditor />
    </SidebarProvider>
  )
}
export default App;