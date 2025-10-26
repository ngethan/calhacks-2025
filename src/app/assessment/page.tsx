"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type Framework = "react-router-v7" | "nextjs" | null;

type AssessmentSession = {
  id: string;
  userId: string;
  framework: string;
  problemContent: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function AnimatedStreamdown({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousLengthRef = useRef(0);
  const observerRef = useRef<MutationObserver | null>(null);

  // Set up mutation observer once
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // Animate newly added elements
            node.style.opacity = "0";
            node.style.animation = "streamFadeIn 1s ease-out forwards";
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            // Animate parent of newly added text nodes
            const parent = node.parentElement;
            if (!parent.classList.contains("stream-animated")) {
              parent.classList.add("stream-animated");
              parent.style.animation = "streamFadeIn 0.5s ease-out forwards";
            }
          }
        }
      }
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });

    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, []);

  // Track content changes
  useEffect(() => {
    if (content.length > previousLengthRef.current) {
      previousLengthRef.current = content.length;
    } else if (content.length === 0) {
      previousLengthRef.current = 0;
    }
  }, [content]);

  return (
    <>
      <style jsx global>{`
        @keyframes streamFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      <div ref={containerRef}>
        <Streamdown>{content}</Streamdown>
      </div>
    </>
  );
}

export default function AssessmentPage() {
  const router = useRouter();
  const [isStreaming, setIsStreaming] = useState(false);
  const [assessmentContent, setAssessmentContent] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<Framework>(null);
  const [activeSession, setActiveSession] = useState<AssessmentSession | null>(
    null,
  );
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [showAbandonConfirmation, setShowAbandonConfirmation] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);

  // Check for active session on mount
  useEffect(() => {
    checkForActiveSession();
  }, []);

  const checkForActiveSession = async () => {
    try {
      const response = await fetch("/api/assessment/active");
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setActiveSession(data.session);
        }
      }
    } catch (error) {
      console.error("Error checking for active session:", error);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleResumeSession = () => {
    if (activeSession) {
      // Navigate to IDE - it will fetch the active session from the database
      router.push("/ide");
    }
  };

  const handleAbandonSession = async () => {
    if (!activeSession) return;

    setIsAbandoning(true);

    try {
      const response = await fetch("/api/assessment/abandon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });

      if (response.ok) {
        setActiveSession(null);
        setShowAbandonConfirmation(false);
        toast.success("Session abandoned! You can now start a new assessment.");
      } else {
        const error = await response.json();
        toast.error(`Failed to abandon session: ${error.error}`);
      }
    } catch (error) {
      console.error("Error abandoning session:", error);
      toast.error("Failed to abandon session. Please try again.");
    } finally {
      setIsAbandoning(false);
    }
  };

  const handleViewProblem = async () => {
    // Check if there's an active session
    if (activeSession) {
      toast.error(
        "You already have an active assessment. Please resume or abandon it first.",
      );
      return;
    }

    setIsStreaming(true);
    setAssessmentContent("");
    setGeneratedAt(new Date().toISOString());

    try {
      const requestBody = selectedFramework
        ? { framework: selectedFramework }
        : {};

      const response = await fetch("/api/ai/assessment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error("Assessment API error:", response.status, errorText);
        throw new Error(
          `Failed to generate assessment: ${response.status} - ${errorText}`,
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setAssessmentContent((prev) => prev + chunk);
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to load assessment: ${errorMsg}`, {
        description: "Please check that you're logged in and try again.",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStartExam = async () => {
    if (!selectedFramework) {
      toast.error("Please select a framework first");
      return;
    }

    setIsStarting(true);

    try {
      // Create assessment session in database
      const response = await fetch("/api/assessment/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          framework: selectedFramework,
          problemContent: assessmentContent,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start assessment");
      }

      const { session } = await response.json();
      console.log("✅ Assessment session created:", session.id);
      console.log("🚀 Navigating to IDE...");
      console.log("Rubric will be generated after IDE loads");

      // Navigate to IDE - it will fetch the active session from the database
      router.push("/ide");
    } catch (error) {
      console.error("Error starting assessment:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to start assessment: ${errorMsg}`);
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 font-bold text-4xl tracking-tight">
            Your Assessment
          </h1>
          <p className="text-muted-foreground">
            Generate and review your coding challenge before starting
          </p>
        </div>

        {isCheckingSession && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                <span className="ml-3 text-muted-foreground">
                  Checking for active sessions...
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {!isCheckingSession && activeSession && (
          <div className="relative">
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-amber-500">
                    Active Session
                  </Badge>
                  <CardTitle>You have an active assessment</CardTitle>
                </div>
                <CardDescription className="text-amber-900 dark:text-amber-100">
                  Started {new Date(activeSession.startedAt).toLocaleString()} •
                  Framework: {activeSession.framework}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground text-sm">
                  You already have an assessment in progress. You can resume
                  where you left off or abandon it to start a new one.
                </p>
                <div className="relative z-10 flex gap-3">
                  <Button
                    onClick={handleResumeSession}
                    className="flex-1"
                    size="lg"
                    disabled={showAbandonConfirmation}
                  >
                    Resume Assessment
                  </Button>
                  <button
                    onClick={() => setShowAbandonConfirmation(true)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-6 font-medium text-sm text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    type="button"
                    disabled={showAbandonConfirmation}
                  >
                    Abandon & Start New
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Confirmation Overlay */}
            {showAbandonConfirmation && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm"
              >
                <div className="mx-4 max-w-md rounded-lg border border-border bg-white p-6 shadow-xl dark:bg-card">
                  <h3 className="mb-2 font-semibold text-lg">
                    Abandon Assessment?
                  </h3>
                  <p className="mb-6 text-muted-foreground text-sm">
                    This action cannot be undone and all progress will be lost.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleAbandonSession}
                      disabled={isAbandoning}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-red-600 px-4 font-medium text-sm text-white transition-all hover:scale-[1.02] hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isAbandoning ? "Abandoning..." : "Abandon"}
                    </button>
                    <button
                      onClick={() => setShowAbandonConfirmation(false)}
                      disabled={isAbandoning}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 font-medium text-foreground text-sm transition-all hover:bg-accent disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {!isCheckingSession &&
          !activeSession &&
          !assessmentContent &&
          !isStreaming && (
            <Card>
              <CardHeader>
                <CardTitle>Ready to Begin?</CardTitle>
                <CardDescription>
                  Click the button below to generate your coding assessment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleViewProblem}
                  size="lg"
                  className="w-full"
                >
                  View Problem
                </Button>
              </CardContent>
            </Card>
          )}

        {!isCheckingSession &&
          !activeSession &&
          (assessmentContent || isStreaming) && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Coding Challenge</CardTitle>
                    {generatedAt && (
                      <Badge variant="secondary">
                        Generated {new Date(generatedAt).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <AnimatedStreamdown content={assessmentContent} />
                    {isStreaming && (
                      <motion.span
                        className="ml-1 inline-block h-5 w-2 bg-primary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.8,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {!isStreaming && assessmentContent && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Select Your Framework</CardTitle>
                      <CardDescription>
                        Choose the framework you'd like to use for this
                        assessment
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFramework("react-router-v7")
                          }
                          className={`rounded-lg border-2 p-6 transition-all hover:shadow-md ${
                            selectedFramework === "react-router-v7"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <img
                              src="/react-router.png"
                              alt="React Router"
                              className="h-12 w-12 shrink-0"
                            />
                            <div className="flex-1 text-left">
                              <div className="mb-1 font-bold text-xl">
                                React Router v7
                              </div>
                              <p className="text-muted-foreground text-sm">
                                Modern React framework with file-based routing
                              </p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedFramework("nextjs")}
                          className={`rounded-lg border-2 p-6 transition-all hover:shadow-md ${
                            selectedFramework === "nextjs"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <img
                              src="/next-icon.png"
                              alt="Next.js"
                              className="h-12 w-12 shrink-0"
                            />
                            <div className="flex-1 text-left">
                              <div className="mb-1 font-bold text-xl">
                                Next.js
                              </div>
                              <p className="text-muted-foreground text-sm">
                                The React framework for production
                              </p>
                            </div>
                          </div>
                        </button>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={handleStartExam}
                        disabled={!selectedFramework || isStarting}
                        size="lg"
                        className="w-full"
                      >
                        {isStarting ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-white border-b-2" />
                            Starting Assessment...
                          </>
                        ) : (
                          "Start Exam"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              )}
            </div>
          )}
      </div>
    </main>
  );
}
