"use client";

import { useEffect, useState } from "react";

export interface RubricStatus {
  isGenerating: boolean;
  isReady: boolean;
  hasFailed: boolean;
  rubric: any | null;
  challenge: string | null;
  framework: string | null;
}

export function useRubricStatus() {
  const [status, setStatus] = useState<RubricStatus>({
    isGenerating: false,
    isReady: false,
    hasFailed: false,
    rubric: null,
    challenge: null,
    framework: null,
  });

  useEffect(() => {
    const checkStatus = () => {
      const isGenerating = localStorage.getItem("rubricGenerating") === "true";
      const hasFailed = localStorage.getItem("rubricGenerationFailed") === "true";
      const rubricData = localStorage.getItem("currentRubric");
      const challenge = localStorage.getItem("currentChallenge");
      const framework = localStorage.getItem("currentFramework");

      setStatus({
        isGenerating,
        isReady: !isGenerating && rubricData !== null,
        hasFailed,
        rubric: rubricData ? JSON.parse(rubricData) : null,
        challenge,
        framework,
      });
    };

    // Check immediately
    checkStatus();

    // Poll for updates every 2 seconds while generating
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  return status;
}

