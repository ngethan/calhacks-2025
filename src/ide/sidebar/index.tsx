"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { type AllPages, type Page, pages, useIDERouter } from "@/ide/router";
import { cn } from "@/lib/utils";
import { memo } from "react";

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
          "flex h-12 w-12 items-center justify-center rounded-none border-l-2",
          currentPage === toPage ? "border-l-active" : "border-l-transparent"
        )}
      >
        <button
          onClick={() => setPage(toPage)}
          className={cn(
            currentPage === toPage
              ? "text-white"
              : "text-muted-foreground hover:text-white"
          )}
        >
          <page.icon size={24} />
        </button>
      </div>
    );
  }
);
SidebarButton.displayName = "SidebarButton";
export const IDESidebar = () => {
  const router = useIDERouter();
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
                setPage={router.setPage}
                toPage={key as AllPages}
                currentPage={router.page}
              />
            );
          })}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {Object.entries(pages).map(([key, page]) => {
          if (!page.bottom) return null;
          return (
            <SidebarMenuButton
              asChild
              key={key}
              className={cn(
                "scale-150 rounded-none border-l-2 hover:cursor-pointer",
                router.page === key ? "border-active" : "border-transparent"
              )}
              onClick={() => router.setPage(key as AllPages)}
            >
              <page.icon size={96} />
            </SidebarMenuButton>
          );
        })}
      </SidebarFooter>
    </Sidebar>
  );
};
