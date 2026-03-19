/**
 * Shared KV-backed Event Service
 * Single source of truth for storing/listing events and RSVPs, scoped by userScopeId (urlSafeId)
 */

export interface EventRecord {
  id: string;
  title: string;
  description: string;
  date: number; // Unix timestamp
  capacity: number; // 0 = unlimited
  price: string; // USD string
  createdAt: number;
  rsvpCount: number;
}

export interface RSVPRecord {
  eventId: string;
  walletAddress: string;
  timestamp: number;
}

export interface EventServiceDeps {
  kv: KVNamespace;
}

export interface CreateEventInput {
  userScopeId: string; // urlSafeId used to scope keys
  title: string;
  description: string;
  date: number; // Unix timestamp
  capacity: number;
  price: string; // USD
}

export interface ListEventsInput {
  userScopeId: string;
}

export interface GetEventInput {
  userScopeId: string;
  eventId: string;
}

export interface RsvpToEventInput {
  userScopeId: string;
  eventId: string;
  walletAddress: string;
}

export interface GetUserRsvpsInput {
  userScopeId: string;
  walletAddress: string;
}

export function createEventService({ kv }: EventServiceDeps) {
  const eventKeyFor = (userScopeId: string, eventId: string) => `${userScopeId}:events:${eventId}`;
  const rsvpKeyFor = (userScopeId: string, eventId: string, walletAddress: string) =>
    `${userScopeId}:rsvps:${eventId}:${walletAddress}`;

  return {
    /**
     * Create a new event scoped to the user's Durable Object instance
     */
    async createEvent({ userScopeId, title, description, date, capacity, price }: CreateEventInput) {
      const eventId = crypto.randomUUID();
      const record: EventRecord = {
        id: eventId,
        title,
        description,
        date,
        capacity,
        price,
        createdAt: Date.now(),
        rsvpCount: 0
      };

      await kv.put(eventKeyFor(userScopeId, eventId), JSON.stringify(record));

      return record;
    },

    /**
     * List all events for a user
     */
    async listEvents({ userScopeId }: ListEventsInput) {
      const prefix = `${userScopeId}:events:`;
      const keys = await kv.list({ prefix });
      const items = await Promise.all(
        keys.keys.map(async (k) => {
          const data = await kv.get(k.name);
          if (!data) return null;
          const record = JSON.parse(data) as EventRecord;
          return {
            id: record.id,
            title: record.title,
            description: record.description,
            date: new Date(record.date).toISOString(),
            capacity: record.capacity,
            price: record.price,
            rsvpCount: record.rsvpCount,
            createdAt: new Date(record.createdAt).toISOString()
          };
        })
      );

      return items.filter(Boolean) as Array<{
        id: string;
        title: string;
        description: string;
        date: string;
        capacity: number;
        price: string;
        rsvpCount: number;
        createdAt: string;
      }>;
    },

    /**
     * Get a specific event by ID
     */
    async getEvent({ userScopeId, eventId }: GetEventInput) {
      const key = eventKeyFor(userScopeId, eventId);
      const data = await kv.get(key);
      if (!data) return null;

      return JSON.parse(data) as EventRecord;
    },

    /**
     * RSVP to an event
     */
    async rsvpToEvent({ userScopeId, eventId, walletAddress }: RsvpToEventInput) {
      const eventKey = eventKeyFor(userScopeId, eventId);
      const rsvpKey = rsvpKeyFor(userScopeId, eventId, walletAddress);

      // Check if already RSVP'd
      const existingRsvp = await kv.get(rsvpKey);
      if (existingRsvp) {
        return { success: false, error: "Already RSVP'd to this event" };
      }

      // Get event
      const eventData = await kv.get(eventKey);
      if (!eventData) {
        return { success: false, error: "Event not found" };
      }

      const event = JSON.parse(eventData) as EventRecord;

      // Check capacity
      if (event.capacity > 0 && event.rsvpCount >= event.capacity) {
        return { success: false, error: "Event is at capacity" };
      }

      // Create RSVP
      const rsvp: RSVPRecord = {
        eventId,
        walletAddress,
        timestamp: Date.now()
      };

      // Increment RSVP count
      event.rsvpCount += 1;

      // Store both
      await kv.put(rsvpKey, JSON.stringify(rsvp));
      await kv.put(eventKey, JSON.stringify(event));

      return { success: true, event, rsvp };
    },

    /**
     * Get all RSVPs for a wallet address
     */
    async getUserRsvps({ userScopeId, walletAddress }: GetUserRsvpsInput) {
      const prefix = `${userScopeId}:rsvps:`;
      const keys = await kv.list({ prefix });

      const rsvps = await Promise.all(
        keys.keys
          .filter(k => k.name.endsWith(`:${walletAddress}`))
          .map(async (k) => {
            const data = await kv.get(k.name);
            if (!data) return null;
            return JSON.parse(data) as RSVPRecord;
          })
      );

      return rsvps.filter(Boolean) as RSVPRecord[];
    }
  } as const;
}

