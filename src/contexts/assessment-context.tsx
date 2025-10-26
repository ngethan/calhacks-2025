"use client";

import { createContext, useContext } from "react";

interface AssessmentContextType {
  userId: string;
  sessionId: string | null;
  framework: string | null;
}

const AssessmentContext = createContext<AssessmentContextType | null>(null);

export function AssessmentProvider({
  children,
  userId,
  sessionId,
  framework,
}: {
  children: React.ReactNode;
  userId: string;
  sessionId: string | null;
  framework: string | null;
}) {
  return (
    <AssessmentContext.Provider value={{ userId, sessionId, framework }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessmentContext() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error(
      "useAssessmentContext must be used within AssessmentProvider",
    );
  }
  return context;
}
