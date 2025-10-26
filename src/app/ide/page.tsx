"use client";

import { useRubricGenerator } from "@/hooks/use-rubric-generator";
import dynamic from "next/dynamic";

const App = dynamic(() => import("@/ide/app"), { ssr: false });

export default function IDEPage() {
  // Auto-generate rubric if needed
  useRubricGenerator();
  
  return <App />;
}
