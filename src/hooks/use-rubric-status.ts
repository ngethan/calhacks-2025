"use client";

import { useEffect, useState } from "react";

export interface RubricStatus {
  isGenerating: boolean;
  isReady: boolean;
  hasFailed: boolean;
  rubric: any | null;
  challenge: string | null;
  framework: string | null;
  sessionId: string | null;
}

export function useRubricStatus() {
  const [status, setStatus] = useState<RubricStatus>({
    isGenerating: false,
    isReady: false,
    hasFailed: false,
    rubric: null,
    challenge: null,
    framework: null,
    sessionId: null,
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/assessment/rubric");

        if (!response.ok) {
          setStatus({
            isGenerating: false,
            isReady: false,
            hasFailed: false,
            rubric: null,
            challenge: null,
            framework: null,
            sessionId: null,
          });
          return;
        }

        const data = await response.json();
        const { sessionId, rubric, framework, problemContent } = data;

        setStatus({
          isGenerating: !rubric, // Still generating if no rubric yet
          isReady: !!rubric,
          hasFailed: false,
          rubric,
          challenge: problemContent,
          framework,
          sessionId,
        });
      } catch (error) {
        console.error("Error checking rubric status:", error);
        setStatus((prev) => ({
          ...prev,
          hasFailed: true,
          isGenerating: false,
        }));
      }
    };

    // Check immediately
    checkStatus();

    // Poll for updates every 2 seconds
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
