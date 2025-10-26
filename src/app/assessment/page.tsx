"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Streamdown } from "streamdown";
import { motion } from "motion/react";

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
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
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
        });
      });
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

    if (
      !confirm(
        "Are you sure you want to abandon your current assessment? This action cannot be undone.",
      )
    ) {
      return;
    }

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
        alert(
          "Session abandoned successfully. You can now start a new assessment.",
        );
      } else {
        const error = await response.json();
        alert(`Failed to abandon session: ${error.error}`);
      }
    } catch (error) {
      console.error("Error abandoning session:", error);
      alert("Failed to abandon session. Please try again.");
    }
  };

  const handleViewProblem = async () => {
    // Check if there's an active session
    if (activeSession) {
      alert(
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(
        `Failed to load assessment: ${errorMessage}\n\nPlease check that you're logged in and try again.`,
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStartExam = async () => {
    if (!selectedFramework) {
      alert("Please select a framework first");
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to start assessment: ${errorMessage}`);
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">
                  Checking for active sessions...
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {!isCheckingSession && activeSession && (
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
              <p className="text-sm text-muted-foreground mb-4">
                You already have an assessment in progress. You can resume where
                you left off or abandon it to start a new one.
              </p>
              <div className="flex gap-3">
                <a
                  href="/ide"
                  className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                  Resume Assessment
                </a>
                <Button
                  onClick={handleAbandonSession}
                  variant="destructive"
                  className="flex-1"
                >
                  Abandon & Start New
                </Button>
              </div>
            </CardContent>
          </Card>
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
                        className="inline-block w-2 h-5 bg-primary ml-1"
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
                          className={`p-6 rounded-lg border-2 transition-all hover:shadow-md ${
                            selectedFramework === "react-router-v7"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <img
                              src="/react-router.png"
                              alt="React Router"
                              className="w-12 h-12 shrink-0"
                            />
                            <div className="text-left flex-1">
                              <div className="text-xl font-bold mb-1">
                                React Router v7
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Modern React framework with file-based routing
                              </p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedFramework("nextjs")}
                          className={`p-6 rounded-lg border-2 transition-all hover:shadow-md ${
                            selectedFramework === "nextjs"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <img
                              src="/next-icon.png"
                              alt="Next.js"
                              className="w-12 h-12 shrink-0"
                            />
                            <div className="text-left flex-1">
                              <div className="text-xl font-bold mb-1">
                                Next.js
                              </div>
                              <p className="text-sm text-muted-foreground">
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
