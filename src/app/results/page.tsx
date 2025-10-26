"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  Trophy,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type GradingResults = {
  overallScore: number;
  overallGrade: string;
  categories: Array<{
    name: string;
    score: number;
    grade: string;
    feedback: string;
    criteria: Array<{
      name: string;
      status: "passed" | "partial" | "failed";
    }>;
  }>;
  aiUtilization: {
    effectiveness: number;
    feedback: string;
  };
  adherenceToPrompt: number;
  strengths: string[];
  areasForImprovement: string[];
};

type SubmissionData = {
  id: string;
  submittedAt: string;
  gradedAt: string | null;
  score: string | null;
  results: GradingResults | null;
  session: {
    framework: string;
    problemContent: string;
    startedAt: string;
    completedAt: string | null;
  };
};

function getGradeColor(
  grade: string,
): "success" | "warning" | "destructive" | "secondary" {
  switch (grade.toLowerCase()) {
    case "excellent":
      return "success";
    case "great":
      return "success";
    case "good":
      return "warning";
    case "needs improvement":
      return "destructive";
    case "poor":
      return "destructive";
    case "fail":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStatusIcon(status: "passed" | "partial" | "failed") {
  switch (status) {
    case "passed":
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "partial":
      return <AlertCircle className="h-4 w-4 text-amber-400" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400" />;
  }
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId");

  const [data, setData] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradingProgress, setGradingProgress] = useState(0);

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "N/A";
    const seconds = Math.floor(
      (new Date(end).getTime() - new Date(start).getTime()) / 1000,
    );
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    if (!submissionId) {
      setError("No submission ID provided");
      setLoading(false);
      return;
    }

    const fetchSubmission = async () => {
      try {
        const response = await fetch(
          `/api/assessment/submission/${submissionId}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch submission");
        }

        const submissionData = (await response.json()) as SubmissionData;
        setData(submissionData);

        // If not graded yet, poll every 3 seconds
        if (!submissionData.gradedAt) {
          setTimeout(fetchSubmission, 3000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching submission:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId]);

  // Animate progress bar while grading
  useEffect(() => {
    if (!data || data.gradedAt) return;

    const interval = setInterval(() => {
      setGradingProgress((prev) => {
        // Gradually increase progress, slowing down as it approaches 95%
        const increment = prev < 70 ? 3 : prev < 85 ? 1.5 : 0.5;
        const next = prev + increment;
        return next >= 95 ? 95 : next;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [data?.gradedAt, data]);

  if (error) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-slate-900">
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]" />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <XCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 font-semibold text-white text-xl">
              Error Loading Results
            </h2>
            <p className="text-white/60">{error}</p>
          </motion.div>
        </div>
      </main>
    );
  }

  if (!data || !data.results) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-slate-900">
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]" />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md text-center"
          >
            <div className="mb-6">
              <h2 className="mb-2 font-semibold text-white text-xl">
                Grading Your Assessment
              </h2>
              <p className="text-white/60">
                This may take 15-30 seconds. Please wait...
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Progress</span>
                <span className="font-medium text-white">
                  {Math.round(gradingProgress)}%
                </span>
              </div>
              <Progress value={gradingProgress} className="h-3 bg-white/10" />
            </div>

            {data && (
              <p className="mt-6 text-white/40 text-xs">
                Submitted at {new Date(data.submittedAt).toLocaleString()}
              </p>
            )}
          </motion.div>
        </div>
      </main>
    );
  }

  const results = data.results;

  return (
    <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen px-4 py-12">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          {/* Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl text-white">
                      Assessment Results
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      {data.session.framework === "react-router-v7"
                        ? "React Router v7"
                        : "Next.js"}{" "}
                      • Completed{" "}
                      {new Date(data.submittedAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className="border-white/20 bg-white/10 px-4 py-2 text-lg text-white"
                  >
                    {results.overallGrade}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Summary Stats - Responsive Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-white/60">Overall Score</span>
                </div>
                <div className="mb-3 font-bold text-3xl text-white">
                  {results.overallScore}%
                </div>
                <Progress
                  value={results.overallScore}
                  className="h-2 bg-white/10"
                />
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-white/60">
                    AI Effectiveness
                  </span>
                </div>
                <div className="mb-1 font-bold text-3xl text-white">
                  {results.aiUtilization.effectiveness}%
                </div>
                <p className="text-white/40 text-xs">AI utilization score</p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-white/60">Adherence</span>
                </div>
                <div className="mb-1 font-bold text-3xl text-white">
                  {results.adherenceToPrompt}%
                </div>
                <p className="text-white/40 text-xs">To requirements</p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-white/60">Duration</span>
                </div>
                <div className="mb-1 font-bold text-3xl text-white">
                  {formatDuration(
                    data.session.startedAt,
                    data.session.completedAt,
                  )}
                </div>
                <p className="text-white/40 text-xs">Time spent</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Strengths & Areas for Improvement */}
          {(results.strengths?.length > 0 ||
            results.areasForImprovement?.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            >
              {results.strengths?.length > 0 && (
                <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {results.strengths.map((strength, idx) => (
                        <li key={idx} className="flex gap-2 text-sm">
                          <span className="text-white/40">•</span>
                          <span className="text-white/80">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {results.areasForImprovement?.length > 0 && (
                <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                      Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {results.areasForImprovement.map((area, idx) => (
                        <li key={idx} className="flex gap-2 text-sm">
                          <span className="text-white/40">•</span>
                          <span className="text-white/80">{area}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Detailed Rubric */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-4"
          >
            <h3 className="font-semibold text-white text-xl">
              Detailed Assessment
            </h3>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {results.categories.map((item, index) => (
                <Card
                  key={index}
                  className="border-white/10 bg-slate-900/50 backdrop-blur-xl"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <CardTitle className="text-white">
                            {item.name}
                          </CardTitle>
                          <Badge
                            variant="secondary"
                            className="border-white/20 bg-white/10 text-white text-xs"
                          >
                            {item.grade}
                          </Badge>
                        </div>
                        <Progress
                          value={item.score}
                          className="h-2 bg-white/10"
                        />
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold text-3xl text-white">
                          {item.score}%
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-white/70 leading-relaxed">
                      {item.feedback}
                    </p>

                    {item.criteria?.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-sm text-white/60">
                          Criteria
                        </p>
                        <div className="space-y-1.5">
                          {item.criteria.map((criterion, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm"
                            >
                              {getStatusIcon(criterion.status)}
                              <span className="text-white/80">
                                {criterion.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* AI Utilization */}
          {results.aiUtilization && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-white">
                    AI Utilization Analysis
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    How effectively you used AI assistance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-white/60">Effectiveness</span>
                    <span className="font-bold text-white text-xl">
                      {results.aiUtilization.effectiveness}%
                    </span>
                  </div>
                  <Progress
                    value={results.aiUtilization.effectiveness}
                    className="mb-4 h-2 bg-white/10"
                  />
                  <p className="text-sm text-white/70 leading-relaxed">
                    {results.aiUtilization.feedback}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Footer Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex justify-center pt-4"
          >
            <Button
              onClick={() => {
                window.location.href = "/";
              }}
              size="lg"
              className="bg-white px-8 text-slate-900 transition-all duration-200 hover:scale-105 hover:bg-white/90"
            >
              Start New Assessment
            </Button>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-slate-900">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
            <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]" />
          </div>
          <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md text-center"
            >
              <div className="mb-6">
                <h2 className="mb-2 font-semibold text-white text-xl">
                  Loading Results...
                </h2>
                <p className="text-white/60">
                  Please wait while we load your assessment results.
                </p>
              </div>
            </motion.div>
          </div>
        </main>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
