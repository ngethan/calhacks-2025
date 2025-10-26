"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportToGitHub } from "@/lib/github-export";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface GitHubExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  onAuthClick: () => void;
}

export function GitHubExportDialog({
  open,
  onOpenChange,
  isAuthenticated,
  onAuthClick,
}: GitHubExportDialogProps) {
  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!repoName.trim()) {
      toast.error("Please enter a repository name");
      return;
    }

    setIsExporting(true);
    toast.info("Exporting to GitHub...", {
      description: "This may take a moment",
    });

    try {
      const result = await exportToGitHub({
        repoName: repoName.trim(),
        repoDescription: repoDescription.trim() || undefined,
        isPrivate,
      });

      if (result.success && result.repoUrl) {
        toast.success("Successfully exported to GitHub!", {
          description: "Your repository has been created",
          action: {
            label: "View Repository",
            onClick: () => window.open(result.repoUrl, "_blank"),
          },
        });
        onOpenChange(false);
        // Reset form
        setRepoName("");
        setRepoDescription("");
        setIsPrivate(false);
      } else {
        toast.error("Failed to export to GitHub", {
          description: result.error || "An unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export to GitHub", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect to GitHub</AlertDialogTitle>
            <AlertDialogDescription>
              You need to connect your GitHub account to export your project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onAuthClick}>
              Connect GitHub
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export to GitHub</AlertDialogTitle>
          <AlertDialogDescription>
            Create a new GitHub repository with your current project files.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="repoName" className="font-medium text-sm">
              Repository Name *
            </label>
            <Input
              id="repoName"
              placeholder="my-awesome-project"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              disabled={isExporting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="repoDescription" className="font-medium text-sm">
              Description (optional)
            </label>
            <Input
              id="repoDescription"
              placeholder="A brief description of your project"
              value={repoDescription}
              onChange={(e) => setRepoDescription(e.target.value)}
              disabled={isExporting}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              disabled={isExporting}
              className="h-4 w-4"
            />
            <label htmlFor="isPrivate" className="text-sm">
              Make repository private
            </label>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExporting}>Cancel</AlertDialogCancel>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExporting ? "Exporting..." : "Create Repository"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
