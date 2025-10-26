"use client";

import { useAssessmentContext } from "@/contexts/assessment-context";
import { fileSystem } from "@/ide/filesystem/zen-fs";
import type {
  ErrorListener,
  PortListener,
  PreviewMessageListener,
  ServerReadyListener,
  WebContainerProcess,
} from "@webcontainer/api";
import { WebContainer } from "@webcontainer/api";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type WebContainerStatus = "booting" | "ready" | "error";

// Framework initialization scripts
const FRAMEWORK_INIT_COMMANDS: Record<string, string[]> = {
  "react-router-v7": [
    "npx -y create-react-router@latest coding-challenge -y && cd coding-challenge",
  ],
  nextjs: [
    "pnpm create next-app@15.5.6 coding-challenge --yes && cd coding-challenge && pnpm run dev",
  ],
};

// Add this new type mapping
type WebContainerEventMap = {
  // webcontainer listeners
  port: PortListener;
  "server-ready": ServerReadyListener;
  "preview-message": PreviewMessageListener;
  error: ErrorListener;

  // our listeners
  "shell-output": (data: string) => void;
};

// Add type for listener with ID
type ListenerEntry<T> = {
  id: string;
  callback: T;
};

type Listeners = {
  [key in keyof WebContainerEventMap]: ListenerEntry<
    WebContainerEventMap[key]
  >[];
};

export const WebContainerContext = createContext<{
  webContainer: WebContainer | null;
  status: WebContainerStatus;
  listeners: React.RefObject<Listeners>;
  shellProcess: WebContainerProcess | null;
  addListener: <T extends keyof WebContainerEventMap>(
    event: T,
    callback: WebContainerEventMap[T],
  ) => string;
  removeListener: (event: keyof WebContainerEventMap, id: string) => void;
} | null>(null);

// Add a global instance holder
let globalWebContainerInstance: {
  webContainer: WebContainer | null;
  status: WebContainerStatus;
  addListener: <T extends keyof WebContainerEventMap>(
    event: T,
    callback: WebContainerEventMap[T],
  ) => string;
  removeListener: (event: keyof WebContainerEventMap, id: string) => void;
} | null = null;

export const WebContainerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { userId, framework, sessionId } = useAssessmentContext();
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const listeners = useRef<Listeners>({
    port: [],
    "server-ready": [],
    "preview-message": [],
    error: [],
    "shell-output": [],
  });
  const status = useRef<WebContainerStatus>("booting");
  const [shellProcess, setShellProcess] = useState<WebContainerProcess | null>(
    null,
  );

  useEffect(() => {
    if (status.current === "booting") {
      status.current = "ready";
      fileSystem.init(sessionId || "default", userId || "default").then(() => {
        WebContainer.boot({ workdirName: "workspace" }).then(
          async (instance) => {
            await fileSystem.mountWebContainer(instance);

            setWebContainer(instance);
            instance.on("port", (port, type, url) => {
              for (const { callback } of listeners.current.port) {
                callback(port, type, url);
              }
            });
            instance.on("server-ready", (port, url) => {
              for (const { callback } of listeners.current["server-ready"]) {
                callback(port, url);
              }
            });
            instance.on("preview-message", (message) => {
              for (const { callback } of listeners.current["preview-message"]) {
                callback(message);
              }
            });
            instance.on("error", (error) => {
              for (const { callback } of listeners.current.error) {
                callback(error);
              }
            });

            const shellProcess = await instance.spawn("jsh", {
              terminal: {
                cols: 80, // default for now
                rows: 12,
              },
            });
            setShellProcess(shellProcess);

            shellProcess.output.pipeTo(
              new WritableStream({
                write(data) {
                  for (const { callback } of listeners.current[
                    "shell-output"
                  ]) {
                    callback(data);
                  }
                },
              }),
            );
            if (framework) {
              FRAMEWORK_INIT_COMMANDS[framework]?.forEach((command) => {
                const writer = shellProcess.input.getWriter();
                writer.write(command + "\n");
                writer.releaseLock();
              });
            }

            // Set the global instance
            globalWebContainerInstance = {
              webContainer: instance,
              status: status.current,
              addListener,
              removeListener,
            };
          }
        );
      });
    }
  }, []);

  // Add the addListener and removeListener functions
  const addListener = <T extends keyof WebContainerEventMap>(
    event: T,
    callback: WebContainerEventMap[T],
  ): string => {
    const id = crypto.randomUUID();
    listeners.current[event].push({ id, callback: callback });
    return id;
  };
  const removeListener = <T extends keyof WebContainerEventMap>(
    event: T,
    id: string,
  ) => {
    listeners.current[event] = listeners.current[event].filter(
      (listener) => listener.id !== id,
    ) as Listeners[T];
  };

  return (
    <WebContainerContext.Provider
      value={{
        webContainer,
        status: status.current,
        listeners,
        shellProcess,
        addListener,
        removeListener,
      }}
    >
      {children}
    </WebContainerContext.Provider>
  );
};

/**
 * Custom hook to access the WebContainer instance
 */
export const useWebContainer = () => {
  const context = useContext(WebContainerContext);
  if (!context) {
    throw new Error(
      "useWebContainer must be used within a WebContainerProvider",
    );
  }
  return {
    ...context,
    listeners: context.listeners.current,
  };
};

// Add a new function to access the WebContainer from vanilla TS
export const getWebContainer = () => {
  if (!globalWebContainerInstance) {
    throw new Error(
      "WebContainer not initialized. Ensure WebContainerProvider is mounted.",
    );
  }
  return globalWebContainerInstance;
};
