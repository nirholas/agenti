/**
 * Session Journal - Memory layer for ClawRouter
 *
 * Maintains a compact record of key actions per session, enabling agents
 * to recall earlier work even when OpenClaw's sessions_history is truncated.
 *
 * How it works:
 * 1. As LLM responses flow through, extracts key actions ("I created X", "I fixed Y")
 * 2. Stores them in a compact journal per session
 * 3. When a request mentions past work ("what did you do today?"), injects the journal
 */

export interface JournalEntry {
  timestamp: number;
  action: string; // Compact description: "Created login component"
  model?: string;
}

export interface SessionJournalConfig {
  /** Maximum entries per session (default: 100) */
  maxEntries?: number;
  /** Maximum age of entries in ms (default: 24 hours) */
  maxAgeMs?: number;
  /** Maximum events to extract per response (default: 5) */
  maxEventsPerResponse?: number;
}

const DEFAULT_CONFIG: Required<SessionJournalConfig> = {
  maxEntries: 100,
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  maxEventsPerResponse: 5,
};

export class SessionJournal {
  private journals: Map<string, JournalEntry[]> = new Map();
  private config: Required<SessionJournalConfig>;

  constructor(config?: SessionJournalConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract key events from assistant response content.
   * Looks for patterns like "I created...", "I fixed...", "Successfully..."
   */
  extractEvents(content: string): string[] {
    if (!content || typeof content !== "string") {
      return [];
    }

    const events: string[] = [];
    const seen = new Set<string>();

    // Patterns for identifying key actions
    // Note: Patterns allow optional words like "also", "then", "have" between "I" and verb
    const patterns = [
      // Creation patterns
      /I (?:also |then |have |)?(?:created|implemented|added|wrote|built|generated|set up|initialized) ([^.!?\n]{10,150})/gi,
      // Fix patterns
      /I (?:also |then |have |)?(?:fixed|resolved|solved|patched|corrected|addressed|debugged) ([^.!?\n]{10,150})/gi,
      // Completion patterns
      /I (?:also |then |have |)?(?:completed|finished|done with|wrapped up) ([^.!?\n]{10,150})/gi,
      // Update patterns
      /I (?:also |then |have |)?(?:updated|modified|changed|refactored|improved|enhanced|optimized) ([^.!?\n]{10,150})/gi,
      // Success patterns
      /Successfully ([^.!?\n]{10,150})/gi,
      // Tool usage patterns (when agent uses tools)
      /I (?:also |then |have |)?(?:ran|executed|called|invoked) ([^.!?\n]{10,100})/gi,
    ];

    for (const pattern of patterns) {
      // Reset pattern lastIndex for each iteration
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const action = match[0].trim();

        // Skip if already seen (dedup)
        const normalized = action.toLowerCase();
        if (seen.has(normalized)) {
          continue;
        }

        // Validate length (not too short or too long)
        if (action.length >= 15 && action.length <= 200) {
          events.push(action);
          seen.add(normalized);
        }

        // Stop if we have enough events
        if (events.length >= this.config.maxEventsPerResponse) {
          break;
        }
      }

      if (events.length >= this.config.maxEventsPerResponse) {
        break;
      }
    }

    return events;
  }

  /**
   * Record events to the session journal.
   */
  record(sessionId: string, events: string[], model?: string): void {
    if (!sessionId || !events.length) {
      return;
    }

    const journal = this.journals.get(sessionId) || [];
    const now = Date.now();

    for (const action of events) {
      journal.push({
        timestamp: now,
        action,
        model,
      });
    }

    // Trim old entries and enforce max count
    const cutoff = now - this.config.maxAgeMs;
    const trimmed = journal.filter((e) => e.timestamp > cutoff).slice(-this.config.maxEntries);

    this.journals.set(sessionId, trimmed);
  }

  /**
   * Check if the user message indicates a need for historical context.
   */
  needsContext(lastUserMessage: string): boolean {
    if (!lastUserMessage || typeof lastUserMessage !== "string") {
      return false;
    }

    const lower = lastUserMessage.toLowerCase();

    // Trigger phrases that indicate user wants to recall past work
    const triggers = [
      // Direct questions about past work
      "what did you do",
      "what have you done",
      "what did we do",
      "what have we done",
      // Temporal references
      "earlier",
      "before",
      "previously",
      "this session",
      "today",
      "so far",
      // Summary requests
      "remind me",
      "summarize",
      "summary of",
      "recap",
      // Progress inquiries
      "your work",
      "your progress",
      "accomplished",
      "achievements",
      "completed tasks",
    ];

    return triggers.some((t) => lower.includes(t));
  }

  /**
   * Format the journal for injection into system message.
   * Returns null if journal is empty.
   */
  format(sessionId: string): string | null {
    const journal = this.journals.get(sessionId);
    if (!journal?.length) {
      return null;
    }

    const lines = journal.map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `- ${time}: ${e.action}`;
    });

    return `[Session Memory - Key Actions]\n${lines.join("\n")}`;
  }

  /**
   * Get the raw journal entries for a session (for debugging/testing).
   */
  getEntries(sessionId: string): JournalEntry[] {
    return this.journals.get(sessionId) || [];
  }

  /**
   * Clear journal for a specific session.
   */
  clear(sessionId: string): void {
    this.journals.delete(sessionId);
  }

  /**
   * Clear all journals.
   */
  clearAll(): void {
    this.journals.clear();
  }

  /**
   * Get stats about the journal.
   */
  getStats(): { sessions: number; totalEntries: number } {
    let totalEntries = 0;
    for (const entries of this.journals.values()) {
      totalEntries += entries.length;
    }
    return {
      sessions: this.journals.size,
      totalEntries,
    };
  }
}
