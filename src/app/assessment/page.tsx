"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
              parent.style.animation = "streamFadeIn 0.25s ease-out forwards";
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [assessmentContent, setAssessmentContent] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<Framework>(null);

  const handleViewProblem = async () => {
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
        throw new Error(`Failed to generate assessment: ${response.status} - ${errorText}`);
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
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to load assessment: ${errorMessage}\n\nPlease check that you're logged in and try again.`);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStartExam = async () => {
    if (!selectedFramework) {
      alert("Please select a framework first");
      return;
    }

    // Store challenge and framework immediately
    localStorage.setItem("currentChallenge", assessmentContent);
    localStorage.setItem("currentFramework", selectedFramework);
    localStorage.setItem("rubricGenerating", "true");

    console.log("🚀 Navigating to IDE...");
    console.log("Rubric will be generated after IDE loads");

    // Navigate immediately - rubric will be generated from IDE
    window.location.href = "/ide";
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

        {!assessmentContent && !isStreaming && (
          <Card>
            <CardHeader>
              <CardTitle>Ready to Begin?</CardTitle>
              <CardDescription>
                Click the button below to generate your coding assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleViewProblem} size="lg" className="w-full">
                View Problem
              </Button>
            </CardContent>
          </Card>
        )}

        {(assessmentContent || isStreaming) && (
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
                      Choose the framework you'd like to use for this assessment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedFramework("react-router-v7")}
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
                      disabled={!selectedFramework}
                      size="lg"
                      className="w-full"
                    >
                      Start Exam
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
