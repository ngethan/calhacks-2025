"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-generates rubric on IDE page load if needed
 * This ensures the request isn't cancelled by page navigation
 */
export function useRubricGenerator() {
  const hasStarted = useRef(false);

  useEffect(() => {
    // Only run once
    if (hasStarted.current) return;

    const needsGeneration = localStorage.getItem("rubricGenerating") === "true";
    const challenge = localStorage.getItem("currentChallenge");
    const framework = localStorage.getItem("currentFramework");

    if (!needsGeneration || !challenge || !framework) {
      return;
    }

    hasStarted.current = true;

    console.log("🔄 Starting rubric generation from IDE...");
    console.log("Framework:", framework);
    console.log("Challenge length:", challenge.length, "characters");

    fetch("/api/ai/grading-rubric", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challenge,
        framework,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Rubric generation failed:", response.status, errorText);
          throw new Error(`Failed to generate grading rubric: ${response.status}`);
        }
        const rubric = await response.json();
        console.log("✅ RUBRIC GENERATED SUCCESSFULLY!");
        console.log("═".repeat(50));
        console.log("Framework:", rubric.framework);
        console.log("Total Points:", rubric.totalPoints);
        console.log("Passing Score:", rubric.passingScore);
        console.log("Categories:", rubric.categories?.length);
        console.log("═".repeat(50));
        console.log("Full Rubric Object:");
        console.log(rubric);
        console.log("═".repeat(50));
        
        localStorage.setItem("currentRubric", JSON.stringify(rubric));
        localStorage.removeItem("rubricGenerating");
      })
      .catch((error) => {
        console.error("❌ Error generating rubric:", error);
        localStorage.setItem("rubricGenerationFailed", "true");
        localStorage.removeItem("rubricGenerating");
      });
  }, []);
}

