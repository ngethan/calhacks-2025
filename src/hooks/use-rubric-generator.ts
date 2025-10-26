"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-generates rubric on IDE page load if needed
 * Fetches active session from database and generates rubric if not present
 */
export function useRubricGenerator() {
  const hasStarted = useRef(false);

  useEffect(() => {
    // Only run once
    if (hasStarted.current) return;

    hasStarted.current = true;

    // Fetch active session from database
    fetch("/api/assessment/rubric")
      .then((response) => {
        if (!response.ok) {
          console.log("No active session found");
          return null;
        }
        return response.json();
      })
      .then((data) => {
        if (!data) return;

        const { sessionId, rubric, framework, problemContent } = data;

        // If rubric already exists, no need to generate
        if (rubric) {
          console.log("✅ Rubric already exists for session:", sessionId);
          return;
        }

        // Generate rubric for this session
        console.log("🔄 Starting rubric generation from IDE...");
        console.log("Session ID:", sessionId);
        console.log("Framework:", framework);
        console.log("Challenge length:", problemContent.length, "characters");

        return fetch("/api/ai/grading-rubric", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            challenge: problemContent,
            framework,
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              const errorText = await response.text();
              console.error(
                "❌ Rubric generation failed:",
                response.status,
                errorText,
              );
              throw new Error(
                `Failed to generate grading rubric: ${response.status}`,
              );
            }
            return response.json();
          })
          .then((rubric) => {
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

            // Save rubric to database
            return fetch("/api/assessment/rubric", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId,
                rubric,
              }),
            });
          })
          .then((response) => {
            if (response && response.ok) {
              console.log("✅ Rubric saved to database");
            }
          });
      })
      .catch((error) => {
        console.error("❌ Error in rubric generation process:", error);
      });
  }, []);
}
