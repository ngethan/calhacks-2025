import { EditorTabContent } from "@/ide/editor/editor-tab-content";
import { IFrame } from "@/ide/iframe";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useMemo } from "react";

export const TabContent = ({
  tab,
  path,
  index,
}: {
  tab: string;
  path: string;
  index: number;
}) => {
  const { name, internal } = useMemo(() => {
    if (path.startsWith("internal:")) {
      return {
        name: path.substring(path.lastIndexOf(":") + 1),
        internal: true,
      };
    }
    return { name: path.substring(path.lastIndexOf("/") + 1), internal: false };
  }, [path]);

  if (internal) {
    if (name === "preview") {
      return (
        <TabsPrimitive.Content value={`${index}`} className="h-full w-full">
          <IFrame />
        </TabsPrimitive.Content>
      );
    }
  }
  return <EditorTabContent tab={tab} path={path} index={index} />;
};
