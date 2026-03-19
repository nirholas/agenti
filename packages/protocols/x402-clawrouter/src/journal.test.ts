import { describe, it, expect, beforeEach } from "vitest";
import { SessionJournal } from "./journal.js";

describe("SessionJournal", () => {
  let journal: SessionJournal;

  beforeEach(() => {
    journal = new SessionJournal();
  });

  describe("extractEvents", () => {
    it("should extract creation events", () => {
      const content = `I created a new login component for the authentication system.`;
      const events = journal.extractEvents(content);
      expect(events).toHaveLength(1);
      expect(events[0]).toContain("created");
      expect(events[0]).toContain("login component");
    });

    it("should extract fix events", () => {
      const content = `I fixed the authentication bug that was causing users to be logged out.`;
      const events = journal.extractEvents(content);
      expect(events).toHaveLength(1);
      expect(events[0]).toContain("fixed");
    });

    it("should extract multiple events from one response", () => {
      const content = `I created a new login component. Then I fixed the authentication bug that was causing issues. I also updated the user profile page.`;
      const events = journal.extractEvents(content);
      expect(events).toHaveLength(3);
      expect(events.some((e) => e.includes("created"))).toBe(true);
      expect(events.some((e) => e.includes("fixed"))).toBe(true);
      expect(events.some((e) => e.includes("updated"))).toBe(true);
    });

    it("should extract success events", () => {
      const content = `Successfully deployed the application to production.`;
      const events = journal.extractEvents(content);
      expect(events).toHaveLength(1);
      expect(events[0]).toContain("Successfully deployed");
    });

    it("should limit to max 5 events per response by default", () => {
      const content = `
        I created component A.
        I fixed bug B.
        I implemented feature C.
        I resolved issue D.
        I added function E.
        I wrote test F.
        I built module G.
      `;
      const events = journal.extractEvents(content);
      expect(events.length).toBeLessThanOrEqual(5);
    });

    it("should skip events that are too short", () => {
      const content = `I fixed it.`; // Too short to be meaningful
      const events = journal.extractEvents(content);
      expect(events).toHaveLength(0);
    });

    it("should handle empty content", () => {
      const events = journal.extractEvents("");
      expect(events).toHaveLength(0);
    });

    it("should handle null/undefined content", () => {
      const events = journal.extractEvents(null as unknown as string);
      expect(events).toHaveLength(0);
    });

    it("should deduplicate similar events", () => {
      const content = `I created a new login component. I also created a new login component for testing.`;
      const events = journal.extractEvents(content);
      // Should deduplicate based on normalized content
      expect(events.length).toBeLessThanOrEqual(2);
    });
  });

  describe("record", () => {
    it("should record events to a session", () => {
      journal.record("session1", ["Created login component", "Fixed auth bug"]);
      const entries = journal.getEntries("session1");
      expect(entries).toHaveLength(2);
    });

    it("should not record empty events", () => {
      journal.record("session1", []);
      const entries = journal.getEntries("session1");
      expect(entries).toHaveLength(0);
    });

    it("should not record if sessionId is empty", () => {
      journal.record("", ["Some event"]);
      const entries = journal.getEntries("");
      expect(entries).toHaveLength(0);
    });

    it("should store model with events", () => {
      journal.record("session1", ["Created component"], "gpt-4");
      const entries = journal.getEntries("session1");
      expect(entries[0].model).toBe("gpt-4");
    });

    it("should append to existing session", () => {
      journal.record("session1", ["Event 1"]);
      journal.record("session1", ["Event 2"]);
      const entries = journal.getEntries("session1");
      expect(entries).toHaveLength(2);
    });

    it("should trim entries when exceeding maxEntries", () => {
      const customJournal = new SessionJournal({ maxEntries: 3 });
      customJournal.record("session1", ["Event 1"]);
      customJournal.record("session1", ["Event 2"]);
      customJournal.record("session1", ["Event 3"]);
      customJournal.record("session1", ["Event 4"]);
      const entries = customJournal.getEntries("session1");
      expect(entries).toHaveLength(3);
      // Should keep the most recent
      expect(entries[2].action).toBe("Event 4");
    });
  });

  describe("needsContext", () => {
    it("should detect 'what did you do' questions", () => {
      expect(journal.needsContext("what did you do today?")).toBe(true);
      expect(journal.needsContext("What did you do earlier?")).toBe(true);
    });

    it("should detect 'what have you done' questions", () => {
      expect(journal.needsContext("what have you done so far?")).toBe(true);
    });

    it("should detect temporal references", () => {
      expect(journal.needsContext("show me what we did earlier")).toBe(true);
      expect(journal.needsContext("what happened before this?")).toBe(true);
      expect(journal.needsContext("what did we do previously?")).toBe(true);
    });

    it("should detect summary requests", () => {
      expect(journal.needsContext("can you summarize your work?")).toBe(true);
      expect(journal.needsContext("remind me what we accomplished")).toBe(true);
      expect(journal.needsContext("give me a recap")).toBe(true);
    });

    it("should detect progress inquiries", () => {
      expect(journal.needsContext("what's your progress?")).toBe(true);
      expect(journal.needsContext("what have you accomplished?")).toBe(true);
    });

    it("should return false for normal requests", () => {
      expect(journal.needsContext("please fix this bug")).toBe(false);
      expect(journal.needsContext("create a new component")).toBe(false);
      expect(journal.needsContext("what is JavaScript?")).toBe(false);
    });

    it("should handle empty input", () => {
      expect(journal.needsContext("")).toBe(false);
      expect(journal.needsContext(null as unknown as string)).toBe(false);
    });
  });

  describe("format", () => {
    it("should return null for empty journal", () => {
      expect(journal.format("nonexistent")).toBeNull();
    });

    it("should format journal entries with timestamps", () => {
      journal.record("session1", ["Created login component", "Fixed auth bug"]);
      const formatted = journal.format("session1");

      expect(formatted).not.toBeNull();
      expect(formatted).toContain("[Session Memory");
      expect(formatted).toContain("Created login component");
      expect(formatted).toContain("Fixed auth bug");
      // Should contain time format like "10:30 AM"
      expect(formatted).toMatch(/\d{2}:\d{2}\s*(AM|PM)/i);
    });

    it("should format as bullet list", () => {
      journal.record("session1", ["Event 1"]);
      const formatted = journal.format("session1");
      expect(formatted).toContain("- ");
    });
  });

  describe("clear", () => {
    it("should clear specific session", () => {
      journal.record("session1", ["Event 1"]);
      journal.record("session2", ["Event 2"]);
      journal.clear("session1");

      expect(journal.getEntries("session1")).toHaveLength(0);
      expect(journal.getEntries("session2")).toHaveLength(1);
    });
  });

  describe("clearAll", () => {
    it("should clear all sessions", () => {
      journal.record("session1", ["Event 1"]);
      journal.record("session2", ["Event 2"]);
      journal.clearAll();

      expect(journal.getEntries("session1")).toHaveLength(0);
      expect(journal.getEntries("session2")).toHaveLength(0);
    });
  });

  describe("getStats", () => {
    it("should return correct stats", () => {
      journal.record("session1", ["Event 1", "Event 2"]);
      journal.record("session2", ["Event 3"]);

      const stats = journal.getStats();
      expect(stats.sessions).toBe(2);
      expect(stats.totalEntries).toBe(3);
    });

    it("should return zero stats for empty journal", () => {
      const stats = journal.getStats();
      expect(stats.sessions).toBe(0);
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe("config options", () => {
    it("should respect custom maxEventsPerResponse", () => {
      const customJournal = new SessionJournal({ maxEventsPerResponse: 2 });
      const content = `I created A. I fixed B. I implemented C. I built D.`;
      const events = customJournal.extractEvents(content);
      expect(events.length).toBeLessThanOrEqual(2);
    });
  });
});
