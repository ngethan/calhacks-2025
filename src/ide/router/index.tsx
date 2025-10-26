import {
  FileTextIcon,
  FilesIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import { create } from "zustand";

export type Page = {
  name: string;
  icon: React.ElementType;
  bottom?: boolean;
};
export type AllPages = "files" | "challenge" | "search" | "settings";
export const pages: { [key in AllPages]: Page } = {
  files: {
    name: "Files",
    icon: FilesIcon,
  },
  search: {
    name: "Search",
    icon: SearchIcon,
  },
  challenge: {
    name: "Challenge",
    icon: FileTextIcon,
  },
  settings: {
    name: "Settings",
    icon: SettingsIcon,
    bottom: true,
  },
};

type IDERouterState = {
  page: AllPages;
  setPage: (page: AllPages) => void;
};

export const useIDERouter = create<IDERouterState>()((set) => ({
  page: "challenge", // Default to challenge page so users see the problem immediately
  setPage: (page) => set({ page }),
}));
