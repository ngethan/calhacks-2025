"use client";

import { WebContainerProvider, useWebContainer } from "@/components/container";
import { GitHubExportDialog } from "@/components/github-export-dialog";
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
import { Eye, Github, Loader2, Menu, MessageSquare, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IFrameProvider } from "./iframe-context";

const AppContent = () => {
  const [showChat, setShowChat] = useState(true);
  const [chatWidth, setChatWidth] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [isGitHubAuthenticated, setIsGitHubAuthenticated] = useState(false);
  const editorState = useEditorState();
  const container = useWebContainer();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for GitHub OAuth callback
  useEffect(() => {
    const githubSuccess = searchParams.get("github_success");
    const githubError = searchParams.get("github_error");

    if (githubSuccess === "true") {
      setIsGitHubAuthenticated(true);
      toast.success("Connected to GitHub successfully!");
      // Show the export dialog
      setShowGitHubDialog(true);
      // Clean up URL
      window.history.replaceState({}, "", "/ide");
    } else if (githubError) {
      toast.error("Failed to connect to GitHub", {
        description: `Error: ${githubError}`,
      });
      // Clean up URL
      window.history.replaceState({}, "", "/ide");
    }
  }, [searchParams]);

  // Check if already authenticated on mount
  useEffect(() => {
    // Check if the github_access_token cookie exists
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/github/check-auth");
        if (response.ok) {
          const data = await response.json();
          setIsGitHubAuthenticated(data.authenticated);
        }
      } catch (error) {
        console.error("Failed to check GitHub auth:", error);
      }
    };
    checkAuth();
  }, []);

  const handleExportToGithub = () => {
    if (isGitHubAuthenticated) {
      setShowGitHubDialog(true);
    } else {
      setShowGitHubDialog(true);
    }
  };

  const handleGitHubAuth = () => {
    toast.info("Connecting to GitHub...");
    window.location.href = "/api/github/oauth";
  };

  const handleSubmit = async () => {
    if (!container || container.status !== "ready") {
      toast.error("Container not ready. Please wait and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get active session from localStorage
      const sessionData = await fetch("/api/assessment/active");
      if (!sessionData.ok) {
        throw new Error("No active assessment session found");
      }

      const { session } = await sessionData.json();
      if (!session) {
        throw new Error("No active assessment session found");
      }

      toast.info("Collecting your code...");

      // Collect all files from the file system
      const files: Record<string, string> = {};
      
      async function readDirectory(path: string) {
        try {
          const entries = await container.instance.fs.readdir(path, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
            
            if (entry.isDirectory()) {
              await readDirectory(fullPath);
            } else if (entry.isFile()) {
              try {
                const content = await container.instance.fs.readFile(fullPath, 'utf-8');
                files[fullPath] = content;
              } catch (err) {
                console.warn(`Could not read file ${fullPath}:`, err);
              }
            }
          }
        } catch (err) {
          console.warn(`Could not read directory ${path}:`, err);
        }
      }

      await readDirectory('/');

      console.log(`Collected ${Object.keys(files).length} files`);

      // Submit the code
      const response = await fetch("/api/assessment/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          code: { files },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit assessment");
      }

      const { submission } = await response.json();
      
      toast.success("Assessment submitted! Redirecting to results...");
      
      // Redirect to results page
      router.push(`/results?submissionId=${submission.id}`);
    } catch (error) {
      console.error("Error submitting assessment:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit assessment"
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-border border-b bg-sidebar px-4 py-2">
        <div className="flex items-center gap-2">
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
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit
                </>
              )}
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
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <SidebarProvider open={false}>
          <IDESidebar />
          <IFrameProvider>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel
                defaultSize={15}
                minSize={12}
                maxSize={30}
                collapsible
              >
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
      <GitHubExportDialog
        open={showGitHubDialog}
        onOpenChange={setShowGitHubDialog}
        isAuthenticated={isGitHubAuthenticated}
        onAuthClick={handleGitHubAuth}
      />
    </div>
  );
};

const App = () => (
  <WebContainerProvider>
    <AppContent />
  </WebContainerProvider>
);

export default App;
