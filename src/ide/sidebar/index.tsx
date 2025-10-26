"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { type AllPages, type Page, pages, useIDERouter } from "@/ide/router";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";
import { toast } from "sonner";

const SidebarButton = memo(
  ({
    page,
    setPage,
    toPage,
    currentPage,
  }: {
    page: Page;
    setPage: (page: AllPages) => void;
    toPage: AllPages;
    currentPage: AllPages;
  }) => {
    return (
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-none border-l-2 transition-colors",
          currentPage === toPage
            ? "border-l-blue-500 bg-sidebar-accent"
            : "border-l-transparent",
        )}
      >
        <button
          type="button"
          onClick={() => setPage(toPage)}
          className={cn(
            "transition-colors",
            currentPage === toPage
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <page.icon size={24} />
        </button>
      </div>
    );
  },
);
SidebarButton.displayName = "SidebarButton";
export const IDESidebar = () => {
  const ideRouter = useIDERouter();
  const nextRouter = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      nextRouter.push("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup className="flex h-full flex-col p-0 pb-2">
          {Object.entries(pages).map(([key, page]) => {
            if (page.bottom) return null;
            return (
              <SidebarButton
                key={key}
                page={page}
                setPage={ideRouter.setPage}
                toPage={key as AllPages}
                currentPage={ideRouter.page}
              />
            );
          })}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "scale-150 rounded-none border-l-2 transition-colors hover:cursor-pointer",
                "border-l-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <Settings size={96} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-48">
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
