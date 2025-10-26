"use client";

import { useWebContainer } from "@/components/container";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

type IFrameContextType = {
  iframeSrc: string | null;
};

const IFrameContext = createContext<IFrameContextType | null>(null);

export const IFrameProvider = ({ children }: { children: ReactNode }) => {
  const { addListener, removeListener } = useWebContainer();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    const serverReadyListenerId = addListener("server-ready", (port, url) => {
      console.log("server-ready", port, url);
      setIframeSrc(url);
    });

    return () => {
      removeListener("server-ready", serverReadyListenerId);
    };
  }, [addListener, removeListener]);

  return (
    <IFrameContext.Provider value={{ iframeSrc }}>
      {children}
    </IFrameContext.Provider>
  );
};

export const useIFrameSrc = () => {
  const context = useContext(IFrameContext);
  if (!context) {
    throw new Error("useIFrameSrc must be used within an IFrameProvider");
  }
  return context;
};
