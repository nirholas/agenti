"use client";

import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/ai-elements/code-block";

interface LogEntry {
  timestamp: string;
  message?: string;
  type?: "result" | "error";
  result?: any;
  error?: string;
}

interface LogViewerProps {
  isActive: boolean;
  eventSource: EventSource | null;
  onResult?: (result: any) => void;
  onError?: (error: string) => void;
}

// Helper function to detect and parse JSON content
const parseLogContent = (
  message: string
):
  | { hasJson: true; prefix: string; jsonContent: string; suffix: string }
  | { hasJson: false; content: string } => {
  // Try to detect JSON patterns in the message
  const jsonMatch = message.match(/({[\s\S]*}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1];
      JSON.parse(jsonStr); // Validate it's valid JSON
      const prefix = message.substring(0, jsonMatch.index);
      const suffix = message.substring((jsonMatch.index || 0) + jsonStr.length);
      return {
        hasJson: true,
        prefix: prefix.trim(),
        jsonContent: jsonStr,
        suffix: suffix.trim(),
      };
    } catch {
      // Not valid JSON, treat as plain text
    }
  }
  return { hasJson: false, content: message };
};

export function LogViewer({
  isActive,
  eventSource,
  onResult,
  onError,
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!eventSource) {
      return;
    }

    // Clear previous logs when starting a new session
    if (isActive) {
      setLogs([]);
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const data: LogEntry = JSON.parse(event.data);
        setLogs((prev) => [...prev, data]);

        if (data.type === "result" && onResult) {
          onResult(data.result);
        } else if (data.type === "error" && onError) {
          onError(data.error || "Unknown error");
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.addEventListener("message", handleMessage);

    return () => {
      eventSource.removeEventListener("message", handleMessage);
    };
  }, [eventSource, isActive, onResult, onError]);

  return (
    <div className="h-full flex flex-col max-w-full">
      <div className="border-b p-3">
        <h3 className="font-semibold">Server Logs</h3>
        <div className="flex items-center gap-2 mt-1">
          <div
            className={`w-2 h-2 rounded-full ${
              isActive ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {isActive ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
      <div className="flex-1 p-3">
        <div className="space-y-2 w-full max-w-full">
          {logs.length === 0 && !isActive && (
            <div className="text-sm text-muted-foreground italic">
              No logs yet. Submit a job to see real-time logs.
            </div>
          )}
          {logs.map((log, index) => (
            <div key={index} className="text-sm font-mono w-full max-w-full">
              <div className="text-xs text-muted-foreground mb-1">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>
              <div
                className={`rounded max-h-96 overflow-auto w-full max-w-full ${
                  log.type === "error"
                    ? "bg-red-50 border border-red-200"
                    : log.type === "result"
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                {(() => {
                  const content =
                    log.message ||
                    (log.type === "result"
                      ? JSON.stringify(log.result, null, 2)
                      : log.error) ||
                    "";

                  const parsed = parseLogContent(content);

                  if (parsed.hasJson) {
                    return (
                      <div className="p-2">
                        {parsed.prefix && (
                          <div
                            className={`text-xs mb-2 ${
                              log.type === "error"
                                ? "text-red-800"
                                : log.type === "result"
                                ? "text-green-800"
                                : "text-gray-800"
                            }`}
                          >
                            {parsed.prefix}
                          </div>
                        )}
                        <CodeBlock
                          code={parsed.jsonContent}
                          language="json"
                          className="text-xs w-full max-w-full overflow-hidden"
                        />
                        {parsed.suffix && (
                          <div
                            className={`text-xs mt-2 ${
                              log.type === "error"
                                ? "text-red-800"
                                : log.type === "result"
                                ? "text-green-800"
                                : "text-gray-800"
                            }`}
                          >
                            {parsed.suffix}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div
                        className={`p-2 text-xs ${
                          log.type === "error"
                            ? "text-red-800"
                            : log.type === "result"
                            ? "text-green-800"
                            : "text-gray-800"
                        }`}
                      >
                        {parsed.content}
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
