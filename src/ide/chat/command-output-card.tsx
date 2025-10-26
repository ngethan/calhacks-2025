"use client";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";

import "@xterm/xterm/css/xterm.css";

interface CommandOutputCardProps {
  command: string;
  output: string;
  cwd?: string;
}

export const CommandOutputCard = ({ command, output, cwd }: CommandOutputCardProps) => {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!termRef.current || terminalInstance.current) return;

    // Create terminal with read-only theme
    const terminal = new Terminal({
      convertEol: true,
      disableStdin: true, // Make it read-only
      cursorBlink: false,
      cursorStyle: "block",
      fontSize: 12,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", "Monaco", monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#528bff",
        selectionBackground: "#3e4451",
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
    });

    // Setup fit addon
    const fit = new FitAddon();
    terminal.loadAddon(fit);

    // Open terminal
    terminal.open(termRef.current);
    
    // Fit to container
    fit.fit();

    terminalInstance.current = terminal;
    fitAddon.current = fit;

    // Write the command prompt
    if (cwd) {
      terminal.writeln(`\x1b[90m${cwd}\x1b[0m`);
    }
    terminal.writeln(`\x1b[32m$\x1b[0m ${command}`);
    terminal.writeln("");

    // Write the output
    if (output) {
      terminal.write(output);
      // Add newline if output doesn't end with one
      if (!output.endsWith("\n")) {
        terminal.writeln("");
      }
    }

    // Cleanup
    return () => {
      terminal.dispose();
      terminalInstance.current = null;
      fitAddon.current = null;
    };
  }, [command, output, cwd]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && terminalInstance.current) {
        try {
          fitAddon.current.fit();
        } catch (e) {
          // Ignore fit errors
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="rounded-md border border-border/50 bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-3 py-2">
        <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground text-xs">
          Command Execution
        </span>
      </div>

      {/* Terminal Output */}
      <div 
        ref={termRef} 
        className="h-[200px] w-full overflow-hidden"
        style={{ 
          padding: "8px",
        }}
      />
    </div>
  );
};

