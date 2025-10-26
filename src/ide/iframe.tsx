import { useWebContainer } from "@/components/container";
import { useIFrameSrc } from "@/ide/iframe-context";

export const IFrame = () => {
  const { webContainer } = useWebContainer();
  const { iframeSrc } = useIFrameSrc();

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
