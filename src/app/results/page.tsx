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
  Trophy,
  XCircle,
} from "lucide-react";

// Mock data - would come from API/database
const mockResults = {
  candidateName: "John Doe",
  assessmentTitle: "Full-Stack Engineer Assessment",
  completedAt: new Date("2025-10-25T14:30:00"),
  duration: 7200, // seconds
  overallScore: 82,
  overallGrade: "Great",
  aiPromptingEffectiveness: 85,
  adherenceToPrompt: 78,
  rubric: [
    {
      category: "Code Quality",
      weight: 30,
      score: 88,
      grade: "Excellent",
      feedback:
        "Clean, well-structured code with proper error handling and best practices. Used TypeScript effectively.",
      criteria: [
        { name: "Type Safety", status: "passed" as const },
        { name: "Error Handling", status: "passed" as const },
        { name: "Code Organization", status: "passed" as const },
      ],
    },
    {
      category: "Feature Completeness",
      weight: 25,
      score: 75,
      grade: "Good",
      feedback:
        "Most required features implemented. Missing optional authentication edge cases.",
      criteria: [
        { name: "Core Features", status: "passed" as const },
        { name: "Edge Cases", status: "partial" as const },
        { name: "UI/UX Requirements", status: "passed" as const },
      ],
    },
    {
      category: "AI Utilization",
      weight: 20,
      score: 92,
      grade: "Excellent",
      feedback:
        "Excellent use of AI assistant with clear, specific prompts. Effectively debugged and iterated.",
      criteria: [
        { name: "Prompt Clarity", status: "passed" as const },
        { name: "Iterative Improvement", status: "passed" as const },
        { name: "Context Awareness", status: "passed" as const },
      ],
    },
    {
      category: "Testing & Debugging",
      weight: 15,
      score: 68,
      grade: "Good",
      feedback: "Basic testing implemented. Could improve edge case coverage.",
      criteria: [
        { name: "Unit Tests", status: "partial" as const },
        { name: "Integration Tests", status: "failed" as const },
        { name: "Error Debugging", status: "passed" as const },
      ],
    },
    {
      category: "Performance",
      weight: 10,
      score: 85,
      grade: "Great",
      feedback:
        "Good optimization practices. Efficient rendering and data fetching.",
      criteria: [
        { name: "Rendering Optimization", status: "passed" as const },
        { name: "Bundle Size", status: "passed" as const },
        { name: "API Efficiency", status: "passed" as const },
      ],
    },
  ],
};

function getGradeColor(grade: string) {
  switch (grade.toLowerCase()) {
    case "excellent":
      return "success";
    case "great":
      return "success";
    case "good":
      return "warning";
    case "needs improvement":
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
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Compact Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-lg">Results</h2>
          <p className="text-muted-foreground text-xs">
            {mockResults.candidateName}
          </p>
        </div>
        <Badge
          variant={getGradeColor(mockResults.overallGrade) as any}
          className="px-3 py-1 text-sm"
        >
          {mockResults.overallGrade}
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
            <div className="font-bold text-xl">{mockResults.overallScore}%</div>
            <Progress value={mockResults.overallScore} className="mt-2 h-1.5" />
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">AI Usage</span>
            </div>
            <div className="font-bold text-xl">
              {mockResults.aiPromptingEffectiveness}%
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
              {mockResults.adherenceToPrompt}%
            </div>
            <p className="mt-0.5 text-muted-foreground text-xs">To prompt</p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Duration</span>
            </div>
            <div className="font-bold text-xl">
              {formatDuration(mockResults.duration)}
            </div>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {mockResults.completedAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Detailed Rubric - Vertical Stack */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Detailed Assessment</h3>

          {mockResults.rubric.map((item, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <CardTitle className="text-sm">
                          {item.category}
                        </CardTitle>
                        <Badge
                          variant={getGradeColor(item.grade) as any}
                          className="text-xs"
                        >
                          {item.grade}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Weight: {item.weight}%
                      </p>
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer Actions - Sticky */}
      <div className="shrink-0 space-y-2 border-t px-4 py-3">
        <button className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90">
          View Code
        </button>
        <button className="w-full rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent">
          Download Report
        </button>
      </div>
    </div>
  );
}
