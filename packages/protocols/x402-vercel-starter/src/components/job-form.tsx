"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface JobFormProps {
  onSubmit: (
    job: string,
    enablePayment: boolean,
    actAsScraper: boolean
  ) => void;
  isSubmitting: boolean;
}

const JOB_DESCRIPTIONS = {
  math: "Performs a simple math operation by calling the x402 paywalled `/api/add` endpoint with predefined values.",
  scrape: (
    <>
      Scrapes the{" "}
      <Link href="/blog" className="underline">
        /blog
      </Link>{" "}
      page to extract article titles. Can optionally act as a web scraper by
      setting the user-agent to 'Bot'. If enabled, this will trigger the
      paywall.
    </>
  ),
};

export function JobForm({ onSubmit, isSubmitting }: JobFormProps) {
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [enablePayment, setEnablePayment] = useState(false);
  const [actAsScraper, setActAsScraper] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJob) {
      onSubmit(selectedJob, enablePayment, actAsScraper);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-3">
        <h3 className="font-semibold">Job Configuration</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select and configure a job to run
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-3 space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">Select Job</label>
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a job..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="math">Math Calculator</SelectItem>
              <SelectItem value="scrape">Web Scraper</SelectItem>
            </SelectContent>
          </Select>

          {selectedJob && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                {JOB_DESCRIPTIONS[selectedJob as keyof typeof JOB_DESCRIPTIONS]}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-payment"
              checked={enablePayment}
              onCheckedChange={(checked) => setEnablePayment(checked === true)}
            />
            <label
              htmlFor="enable-payment"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Enable Payment
            </label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            Use `x402-fetch` fetch wrapper for HTTP requests to automatically
            retry 402ed requests with payment
          </p>

          {selectedJob === "scrape" && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="act-as-scraper"
                  checked={actAsScraper}
                  onCheckedChange={(checked) =>
                    setActAsScraper(checked === true)
                  }
                />
                <label
                  htmlFor="act-as-scraper"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Act as Web Scraper
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Set user-agent to 'Bot' for scraping behavior
              </p>
            </>
          )}
        </div>

        <div className="flex-1" />

        <Button
          type="submit"
          disabled={!selectedJob || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Running..." : "Submit Job"}
        </Button>
      </form>
    </div>
  );
}
