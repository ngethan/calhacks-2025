import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { createContext, useCallback, useEffect, useRef } from "react";

import { ResizablePanel } from "@/components/ui/resizable";

import "@xterm/xterm/css/xterm.css";
import "@/components/xterm-console/index.css";
import { useWebContainer } from "@/components/container";

export const TerminalStateProvider = createContext<{
  resize: () => void;
}>({
  resize: () => {},
});

const XTermConsole = () => {
  const termRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal>(
    new Terminal({
      convertEol: true,
      theme: {
        background: "#282c34",
        foreground: "#abb2bf",
        cursor: "#528bff",
        selectionBackground: "#3e4451",
        selectionInactiveBackground: "#3e4451",
        black: "#282c34",
        brightBlack: "#5c6370",
        red: "#e06c75",
        brightRed: "#be5046",
        green: "#98c379",
        brightGreen: "#98c379",
        yellow: "#e5c07b",
        brightYellow: "#d19a66",
        blue: "#61afef",
        brightBlue: "#61afef",
        magenta: "#c678dd",
        brightMagenta: "#c678dd",
        cyan: "#56b6c2",
        brightCyan: "#56b6c2",
        white: "#abb2bf",
        brightWhite: "#ffffff",
      },
    })
  );
  const fitAddon = useRef<FitAddon>(new FitAddon());
  const { status, shellProcess, addListener, removeListener } =
    useWebContainer();
  useEffect(() => {
    term.current.write(`\x1b[34m[WebContainer]\x1b[0m ${status}\n`);
  }, [status]);

  const resize = useCallback(() => {
    fitAddon.current.fit();
    if (shellProcess) {
      shellProcess.resize({
        cols: term.current.cols,
        rows: term.current.rows,
      });
    }
  }, [shellProcess]);

  useEffect(() => {
    if (termRef.current) {
      const terminal = term.current;
      terminal.loadAddon(fitAddon.current);
      terminal.loadAddon(new WebLinksAddon());
      terminal.open(termRef.current);
      fitAddon.current.fit();
      requestAnimationFrame(() => {
        resize();
      });

      // terminal.attachCustomKeyEventHandler((e) => {
      //   const termCfg = useConfig.getState().terminal;
      //   if (e.key === "c" && e.ctrlKey && termCfg.overrideCtrlC) {
      //     const selection = terminal.getSelection();
      //     if (selection) {
      //       navigator.clipboard.writeText(selection);
      //     } else {
      //       interruptExecution();
      //     }
      //     return false;
      //   } else if (e.key === "v" && e.ctrlKey && termCfg.overrideCtrlV) {
      //     /*navigator.clipboard.readText().then((text) => {
      //       terminal.write(text);
      //     });*/
      //     return false; // returning false will allow the default action to occur (paste)
      //   }
      //   return true;
      // });

      // window.term = terminal;
    }
  }, [resize]);

  useEffect(() => {
    const shellOutputListenerId = addListener("shell-output", (data) => {
      term.current.write(data);
    });

    return () => {
      removeListener("shell-output", shellOutputListenerId);
    };
  }, [addListener, removeListener]);

  useEffect(() => {
    if (shellProcess) {
      if (shellProcess.input.locked) {
        term.current.write("Input is locked\n");
        return;
      }
      const input = shellProcess.input.getWriter();
      resize();
      const disposable = term.current.onData((data) => {
        input.write(data);
      });
      return () => {
        disposable.dispose();
        input.close();
      };
    }
  }, [shellProcess, resize]);

  return (
    <ResizablePanel defaultSize={30} onResize={resize} className="h-full">
      <div id="terminal" ref={termRef} className={"h-full w-full"} />
    </ResizablePanel>
  );
};
export default XTermConsole;
