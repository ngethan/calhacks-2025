"use client";

import { useEffect, useState } from "react";

interface AssessmentSession {
  id: string;
  userId: string;
  framework: string;
  problemContent: string;
  rubric: unknown;
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssessmentState {
  // Session data
  session: AssessmentSession | null;
  sessionId: string | null;
  framework: string | null;
  status: "active" | "completed" | "abandoned" | null;

  // Problem data
  problemContent: string | null;
  problemName: string;

  // Rubric data
  rubric: unknown;
  hasRubric: boolean;
  isGeneratingRubric: boolean;

  // Timer data
  timeRemaining: string;
  isExpired: boolean;

  // Loading states
  isLoading: boolean;
  hasError: boolean;
}

const ASSESSMENT_DURATION_MS = 60 * 60 * 1000; // 60 minutes in milliseconds

/**
 * Unified hook for managing all assessment state
 * Fetches session, rubric, and tracks timer
 */
export function useAssessment(): AssessmentState {
  const [state, setState] = useState<AssessmentState>({
    session: null,
    sessionId: null,
    framework: null,
    status: null,
    problemContent: null,
    problemName: "No Active Assessment",
    rubric: null,
    hasRubric: false,
    isGeneratingRubric: false,
    timeRemaining: "--:--",
    isExpired: false,
    isLoading: true,
    hasError: false,
  });

  const [startedAt, setStartedAt] = useState<Date | null>(null);

  // Fetch session and rubric data
  useEffect(() => {
    const fetchAssessmentData = async () => {
      try {
        // Fetch active session
        const sessionResponse = await fetch("/api/assessment/active");
        if (!sessionResponse.ok) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            hasError: false,
          }));
          return;
        }

        const { session } = await sessionResponse.json();
        if (!session) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            hasError: false,
          }));
          return;
        }

        // Extract problem name
        const problemName = extractProblemName(session.problemContent);

        // Set session data and start timer
        setStartedAt(new Date(session.startedAt));
        setState((prev) => ({
          ...prev,
          session,
          sessionId: session.id,
          framework: session.framework,
          status: session.status,
          problemContent: session.problemContent,
          problemName,
          rubric: session.rubric,
          hasRubric: !!session.rubric,
          isGeneratingRubric: !session.rubric,
          isLoading: false,
        }));
      } catch (error) {
        console.error("Error fetching assessment data:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          hasError: true,
        }));
      }
    };

    fetchAssessmentData();

    // Poll for rubric updates every 5 seconds if rubric is being generated
    const pollInterval = setInterval(() => {
      if (state.isGeneratingRubric && !state.hasRubric) {
        fetchAssessmentData();
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [state.isGeneratingRubric, state.hasRubric]);

  // Update timer every second
  useEffect(() => {
    if (!startedAt) return;

    const updateTimer = () => {
      const now = new Date();
      const elapsedMs = now.getTime() - startedAt.getTime();
      const remainingMs = ASSESSMENT_DURATION_MS - elapsedMs;

      if (remainingMs <= 0) {
        setState((prev) => ({
          ...prev,
          timeRemaining: "0:00",
          isExpired: true,
        }));
        return;
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      setState((prev) => ({
        ...prev,
        timeRemaining: `${minutes}:${seconds.toString().padStart(2, "0")}`,
        isExpired: false,
      }));
    };

    // Update immediately
    updateTimer();

    // Then update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return state;
}

/**
 * Extract a problem name from the markdown content
 * Tries to find the first heading or first meaningful line
 */
function extractProblemName(content: string): string {
  if (!content) return "Coding Assessment";

  // Try to find a markdown heading (# Title)
  const headingMatch = content.match(/^#+ (.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  // Otherwise, get the first non-empty line (up to 50 chars)
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length > 0 && lines[0]) {
    const firstLine = lines[0].trim();
    return firstLine.length > 50
      ? `${firstLine.substring(0, 50)}...`
      : firstLine;
  }

  return "Coding Assessment";
}
