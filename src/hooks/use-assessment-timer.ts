"use client";

import { useEffect, useState } from "react";

interface AssessmentTimerData {
  timeRemaining: string;
  problemName: string;
  isExpired: boolean;
  isLoading: boolean;
}

const ASSESSMENT_DURATION_MS = 60 * 60 * 1000;

export function useAssessmentTimer(): AssessmentTimerData {
  const [data, setData] = useState<AssessmentTimerData>({
    timeRemaining: "--:--",
    problemName: "Loading...",
    isExpired: false,
    isLoading: true,
  });

  const [startedAt, setStartedAt] = useState<Date | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/assessment/active");
        if (!response.ok) {
          setData({
            timeRemaining: "--:--",
            problemName: "No Active Assessment",
            isExpired: false,
            isLoading: false,
          });
          return;
        }

        const { session } = await response.json();
        if (!session) {
          setData({
            timeRemaining: "--:--",
            problemName: "No Active Assessment",
            isExpired: false,
            isLoading: false,
          });
          return;
        }

        // Extract problem name from first line/heading of problemContent
        const problemName = extractProblemName(session.problemContent);

        setStartedAt(new Date(session.startedAt));
        setData((prev) => ({
          ...prev,
          problemName,
          isLoading: false,
        }));
      } catch (error) {
        console.error("Error fetching assessment session:", error);
        setData({
          timeRemaining: "--:--",
          problemName: "Error",
          isExpired: false,
          isLoading: false,
        });
      }
    };

    fetchSession();
  }, []);

  // Update timer every second
  useEffect(() => {
    if (!startedAt) return;

    const updateTimer = () => {
      const now = new Date();
      const elapsedMs = now.getTime() - startedAt.getTime();
      const remainingMs = ASSESSMENT_DURATION_MS - elapsedMs;

      if (remainingMs <= 0) {
        setData((prev) => ({
          ...prev,
          timeRemaining: "0:00",
          isExpired: true,
        }));
        return;
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      setData((prev) => ({
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

  return data;
}

function extractProblemName(content: string): string {
  if (!content) return "Coding Assessment";

  // Try to find a markdown heading (# Title)
  const headingMatch = content.match(/^#+ (.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  return "Coding Assessment";
}
