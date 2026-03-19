"use client";

import { useState } from "react";
import { JobForm } from "@/components/job-form";
import { LogViewer } from "@/components/log-viewer";

export default function Playground() {
  const [isJobRunning, setIsJobRunning] = useState(false);
  const [currentEventSource, setCurrentEventSource] =
    useState<EventSource | null>(null);

  const handleJobSubmit = async (
    job: string,
    enablePayment: boolean,
    actAsScraper: boolean
  ) => {
    // Close any existing connection
    if (currentEventSource) {
      currentEventSource.close();
    }

    setIsJobRunning(true);

    try {
      // Create the request URL with job parameter and headers as query params
      const url = new URL("/api/bot", window.location.origin);
      url.searchParams.set("job", job);

      if (enablePayment) {
        url.searchParams.set("enable-payment", "true");
      }

      if (actAsScraper && job === "scrape") {
        url.searchParams.set("act-as-scraper", "true");
      }

      // Create EventSource for the specific job
      const eventSource = new EventSource(url.toString());
      setCurrentEventSource(eventSource);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "result" || data.type === "error") {
            // Job completed
            setIsJobRunning(false);
            eventSource.close();
            setCurrentEventSource(null);
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        setIsJobRunning(false);
        eventSource.close();
        setCurrentEventSource(null);
      };
    } catch (error) {
      console.error("Error submitting job:", error);
      setIsJobRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Job Playground</h1>
        <p className="text-muted-foreground mt-2">
          Test different jobs that use x402 paywalled endpoints and watch
          real-time server logs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Job Form */}
        <div className="border rounded-lg">
          <JobForm onSubmit={handleJobSubmit} isSubmitting={isJobRunning} />
        </div>

        {/* Right side - Log Viewer */}
        <div className="border rounded-lg">
          <LogViewer isActive={isJobRunning} eventSource={currentEventSource} />
        </div>
      </div>
    </div>
  );
}
