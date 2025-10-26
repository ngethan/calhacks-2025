"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";

export const ChallengePage = () => {
  const [challenge, setChallenge] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    console.log("[Challenge Page] Component mounted, fetching challenge...");
    
    // Fetch the active assessment session to get the challenge
    fetch("/api/assessment/rubric")
      .then((response) => {
        console.log("[Challenge Page] Response status:", response.status);
        if (!response.ok) {
          throw new Error("No active assessment found");
        }
        return response.json();
      })
      .then((data) => {
        console.log("[Challenge Page] Received data:", data);
        console.log("[Challenge Page] Problem content:", data.problemContent);
        console.log("[Challenge Page] Problem content length:", data.problemContent?.length);
        
        setDebugInfo(`Received ${data.problemContent?.length || 0} characters`);
        
        if (!data.problemContent) {
          throw new Error("No problem content found in response");
        }
        
        setChallenge(data.problemContent);
        setLoading(false);
        console.log("[Challenge Page] ✅ Challenge set successfully!");
      })
      .catch((err) => {
        console.error("[Challenge Page] Error fetching challenge:", err);
        setDebugInfo(`Error: ${err.message}`);
        setError(err.message || "Failed to load challenge");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!challenge || challenge.trim().length === 0) {
    console.log("[Challenge Page] ❌ Challenge is empty or null");
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No challenge content available</p>
          <p className="text-xs text-muted-foreground mt-2">Check the browser console for details</p>
        </div>
      </div>
    );
  }

  console.log("[Challenge Page] ✅ Rendering challenge, length:", challenge.length);

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="mb-6 border-b border-border pb-4">
          <h2 className="text-2xl font-bold tracking-tight mb-2">📋 Your Coding Challenge</h2>
          <p className="text-sm text-muted-foreground">
            Read the requirements carefully. You can switch to the Files tab to start coding.
          </p>
          {debugInfo && (
            <p className="text-xs text-blue-500 mt-2">Debug: {debugInfo}</p>
          )}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Streamdown>{challenge}</Streamdown>
        </div>
      </div>
    </ScrollArea>
  );
};

