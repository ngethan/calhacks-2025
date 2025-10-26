"use client";

import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Trophy,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "partial":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId");
  
  const [data, setData] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "N/A";
    const seconds = Math.floor(
      (new Date(end).getTime() - new Date(start).getTime()) / 1000
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
        const response = await fetch(`/api/assessment/submission/${submissionId}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch submission");
        }

        const submissionData = await response.json() as SubmissionData;
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

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-8">
        <XCircle className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="mb-2 font-semibold text-xl">Error Loading Results</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data || !data.results) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-8">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
        <h2 className="mb-2 font-semibold text-xl">Grading Your Assessment</h2>
        <p className="text-center text-muted-foreground">
          This may take 15-30 seconds. Please wait...
        </p>
        {data && (
          <p className="mt-2 text-muted-foreground text-xs">
            Submitted at {new Date(data.submittedAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  const results = data.results;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Compact Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-lg">Assessment Results</h2>
          <p className="text-muted-foreground text-xs">
            {data.session.framework === "react-router-v7" ? "React Router v7" : "Next.js"}
          </p>
        </div>
        <Badge
          variant={getGradeColor(results.overallGrade)}
          className="px-3 py-1 text-sm"
        >
          {results.overallGrade}
        </Badge>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* Summary Stats - Compact Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Score</span>
            </div>
            <div className="font-bold text-xl">{results.overallScore}%</div>
            <Progress value={results.overallScore} className="mt-2 h-1.5" />
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">AI Usage</span>
            </div>
            <div className="font-bold text-xl">
              {results.aiUtilization.effectiveness}%
            </div>
            <p className="mt-0.5 text-muted-foreground text-xs">
              Effectiveness
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Adherence</span>
            </div>
            <div className="font-bold text-xl">
              {results.adherenceToPrompt}%
            </div>
            <p className="mt-0.5 text-muted-foreground text-xs">To prompt</p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Duration</span>
            </div>
            <div className="font-bold text-xl">
              {formatDuration(data.session.startedAt, data.session.completedAt)}
            </div>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {new Date(data.submittedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Strengths & Areas for Improvement */}
        {(results.strengths?.length > 0 || results.areasForImprovement?.length > 0) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {results.strengths?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {results.strengths.map((strength, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {results.areasForImprovement?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    Areas for Improvement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {results.areasForImprovement.map((area, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Detailed Rubric - Vertical Stack */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Detailed Assessment</h3>

          {results.categories.map((item, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <CardTitle className="text-sm">
                          {item.name}
                        </CardTitle>
                        <Badge
                          variant={getGradeColor(item.grade)}
                          className="text-xs"
                        >
                          {item.grade}
                        </Badge>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-2xl">{item.score}%</div>
                    </div>
                  </div>
                  <Progress value={item.score} className="h-1.5" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {item.feedback}
                </p>

                {item.criteria?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-xs">Criteria</p>
                    <div className="space-y-1">
                      {item.criteria.map((criterion, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs"
                        >
                          {getStatusIcon(criterion.status)}
                          <span className="truncate">{criterion.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Utilization */}
        {results.aiUtilization && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Utilization Analysis</CardTitle>
              <CardDescription className="text-xs">
                How effectively you used AI assistance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Effectiveness</span>
                <span className="font-bold">{results.aiUtilization.effectiveness}%</span>
              </div>
              <Progress value={results.aiUtilization.effectiveness} className="mb-3 h-2" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                {results.aiUtilization.feedback}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer Actions - Sticky */}
      <div className="shrink-0 space-y-2 border-t px-4 py-3">
        <button
          onClick={() => window.location.href = "/assessment"}
          className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        >
          Start New Assessment
        </button>
      </div>
    </div>
  );
}
