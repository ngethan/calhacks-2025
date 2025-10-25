import { useWebContainer } from "@/components/container";
import { useState } from "react";

import { useEffect } from "react";

export const IFrame = () => {
  const { webContainer, addListener, removeListener } = useWebContainer();
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
  if (!webContainer) {
    return <></>;
  }
  return (
    <>
      {iframeSrc ? (
        <iframe title="iframe" src={iframeSrc} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <h1>No dev server detected yet</h1>
        </div>
      )}
    </>
  );
};
