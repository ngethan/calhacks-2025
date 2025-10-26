"use client";

import dynamic from "next/dynamic";
import { useRubricGenerator } from "@/hooks/use-rubric-generator";

const App = dynamic(() => import("@/ide/app"), { ssr: false });

export default function IDEPage() {
  // Auto-generate rubric if needed
  useRubricGenerator();

  return <App />;
}
