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
import { Streamdown } from "streamdown";
import { toast } from "sonner";

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
    null
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
        "You already have an active assessment. Please resume or abandon it first."
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
          `Failed to generate assessment: ${response.status} - ${errorText}`
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
    <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {isCheckingSession && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center text-center"
            >
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-white/20 border-t-white border-4" />
              <p className="text-white/60 text-lg">
                Checking for active sessions...
              </p>
            </motion.div>
          )}

          {!isCheckingSession && activeSession && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mx-auto max-w-2xl"
            >
              <div className="rounded-2xl border border-amber-500/30 bg-linear-to-b from-amber-500/10 to-transparent p-8 backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-center gap-3">
                  <Badge
                    variant="default"
                    className="bg-amber-500 px-4 py-1.5 text-sm"
                  >
                    Active Session
                  </Badge>
                </div>
                <h2 className="mb-2 text-center font-bold text-2xl text-white">
                  Assessment In Progress
                </h2>
                <p className="mb-6 text-center text-amber-200/80">
                  Started {new Date(activeSession.startedAt).toLocaleString()} •
                  Framework: {activeSession.framework}
                </p>
                <p className="mb-8 text-center text-white/60 text-sm">
                  You already have an assessment in progress. You can resume
                  where you left off or abandon it to start a new one.
                </p>
                <div className="flex gap-4 relative z-10">
                  <Button
                    onClick={handleResumeSession}
                    className="flex-1 bg-white text-slate-900 hover:bg-white/90"
                    size="lg"
                    disabled={showAbandonConfirmation}
                  >
                    Resume Assessment
                  </Button>
                  <button
                    onClick={() => setShowAbandonConfirmation(true)}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-6 font-medium text-sm text-red-200 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
                    type="button"
                    disabled={showAbandonConfirmation}
                  >
                    Abandon & Start New
                  </button>
                </div>
              </div>

              {/* Confirmation Overlay */}
              {showAbandonConfirmation && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/80 backdrop-blur-md"
                >
                  <div className="mx-4 max-w-md rounded-xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
                    <h3 className="mb-2 font-semibold text-lg text-white">
                      Abandon Assessment?
                    </h3>
                    <p className="mb-6 text-white/60 text-sm">
                      This action cannot be undone and all progress will be
                      lost.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleAbandonSession}
                        disabled={isAbandoning}
                        className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-red-600 px-4 font-medium text-sm text-white transition-all hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isAbandoning ? "Abandoning..." : "Abandon"}
                      </button>
                      <button
                        onClick={() => setShowAbandonConfirmation(false)}
                        disabled={isAbandoning}
                        className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-white/20 bg-transparent px-4 font-medium text-sm text-white transition-all hover:bg-white/10 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {!isCheckingSession &&
            !activeSession &&
            !assessmentContent &&
            !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mx-auto max-w-3xl text-center"
              >
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-6"
                >
                  <Badge
                    variant="secondary"
                    className="mb-6 border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-blue-200 text-sm backdrop-blur-sm"
                  >
                    AI-Powered Assessment
                  </Badge>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6 bg-linear-to-br from-white via-white to-white/40 bg-clip-text font-bold text-6xl tracking-tight text-transparent leading-tight"
                >
                  Your Coding
                  <br />
                  Assessment
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mb-12 text-lg text-white/60 leading-relaxed"
                >
                  Generate and review your personalized coding challenge
                  <br />
                  powered by advanced AI evaluation
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    onClick={handleViewProblem}
                    size="lg"
                    className="group h-14 bg-white px-8 text-base text-slate-900 hover:bg-white/90 hover:scale-105 transition-all duration-200"
                  >
                    Generate Challenge
                    <svg
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </Button>
                </motion.div>
              </motion.div>
            )}

          {!isCheckingSession &&
            !activeSession &&
            (assessmentContent || isStreaming) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">
                        Coding Challenge
                      </CardTitle>
                      {generatedAt && (
                        <Badge
                          variant="secondary"
                          className="border-white/10 bg-white/5 text-white/60"
                        >
                          Generated {new Date(generatedAt).toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none *:text-white/80">
                      <AnimatedStreamdown content={assessmentContent} />
                      {isStreaming && (
                        <motion.span
                          className="ml-1 inline-block h-5 w-2 bg-white"
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
                    <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-white">
                          Select Your Framework
                        </CardTitle>
                        <CardDescription className="text-white/60">
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
                            className={`rounded-lg border-2 p-6 transition-all hover:shadow-lg hover:scale-[1.02] ${
                              selectedFramework === "react-router-v7"
                                ? "border-white/30 bg-white/10"
                                : "border-white/10 hover:border-white/30 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 items-center justify-center shrink-0">
                                <img
                                  src="/react-router.png"
                                  alt="React Router"
                                  className="h-12 w-auto max-w-none object-contain"
                                />
                              </div>
                              <div className="flex-1 text-left">
                                <div className="mb-1 font-bold text-white text-xl">
                                  React Router v7
                                </div>
                                <p className="text-sm text-white/60">
                                  Modern React framework with file-based routing
                                </p>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedFramework("nextjs")}
                            className={`rounded-lg border-2 p-6 transition-all hover:shadow-lg hover:scale-[1.02] ${
                              selectedFramework === "nextjs"
                                ? "border-white/30 bg-white/10"
                                : "border-white/10 hover:border-white/30 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 items-center justify-center shrink-0">
                                <img
                                  src="/next-icon.png"
                                  alt="Next.js"
                                  className="h-12 w-auto max-w-none object-contain"
                                />
                              </div>
                              <div className="flex-1 text-left">
                                <div className="mb-1 font-bold text-white text-xl">
                                  Next.js
                                </div>
                                <p className="text-sm text-white/60">
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
                          className="w-full bg-white text-slate-900 hover:bg-white/90"
                        >
                          {isStarting ? (
                            <>
                              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-slate-900 border-b-2" />
                              Starting Assessment...
                            </>
                          ) : (
                            "Start Assessment"
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                )}
              </motion.div>
            )}
        </div>
      </div>
    </main>
  );
}
