/**
 * Session Storage Interface for Persistent Session Management
 *
 * Provides abstraction over different storage backends (in-memory, Redis, PostgreSQL, etc.)
 */

import type { ShelbySession } from "../types/index.js";

/**
 * Session storage interface
 *
 * Implement this interface to provide persistent session storage
 */
export interface ISessionStorage {
	/**
	 * Store a session
	 */
	set(sessionId: string, session: ShelbySession): Promise<void>;

	/**
	 * Retrieve a session
	 */
	get(sessionId: string): Promise<ShelbySession | null>;

	/**
	 * Update session chunksets
	 */
	updateChunksets(sessionId: string, chunksetsRemaining: number): Promise<void>;

	/**
	 * Delete a session
	 */
	delete(sessionId: string): Promise<void>;

	/**
	 * Get all sessions for a user
	 */
	getByUser(userAddress: string): Promise<ShelbySession[]>;

	/**
	 * Clean up expired sessions
	 */
	cleanExpired(): Promise<number>;
}

/**
 * In-Memory Session Storage (Default)
 *
 * Simple Map-based storage for development/testing
 * NOT recommended for production (data lost on restart)
 */
export class InMemorySessionStorage implements ISessionStorage {
	private sessions: Map<string, ShelbySession>;

	constructor() {
		this.sessions = new Map();
	}

	async set(sessionId: string, session: ShelbySession): Promise<void> {
		this.sessions.set(sessionId, session);
	}

	async get(sessionId: string): Promise<ShelbySession | null> {
		return this.sessions.get(sessionId) || null;
	}

	async updateChunksets(sessionId: string, chunksetsRemaining: number): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.chunksetsRemaining = chunksetsRemaining;
			this.sessions.set(sessionId, session);
		}
	}

	async delete(sessionId: string): Promise<void> {
		this.sessions.delete(sessionId);
	}

	async getByUser(userAddress: string): Promise<ShelbySession[]> {
		const sessions: ShelbySession[] = [];
		for (const session of this.sessions.values()) {
			if (session.userAddress === userAddress) {
				sessions.push(session);
			}
		}
		return sessions;
	}

	async cleanExpired(): Promise<number> {
		const now = Date.now();
		let count = 0;

		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.expiresAt < now) {
				this.sessions.delete(sessionId);
				count++;
			}
		}

		return count;
	}
}

/**
 * Redis Session Storage
 *
 * Production-ready storage using Redis
 * Install: npm install redis
 *
 * @example
 * ```typescript
 * import { createClient } from 'redis';
 *
 * const redis = createClient({ url: process.env.REDIS_URL });
 * await redis.connect();
 *
 * const storage = new RedisSessionStorage(redis);
 * ```
 */
export class RedisSessionStorage implements ISessionStorage {
	private redis: any; // Type as `RedisClientType` if redis is installed
	private keyPrefix: string;

	constructor(redis: any, keyPrefix = "shelby:session:") {
		this.redis = redis;
		this.keyPrefix = keyPrefix;
	}

	async set(sessionId: string, session: ShelbySession): Promise<void> {
		const key = this.keyPrefix + sessionId;
		const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);

		await this.redis.set(key, JSON.stringify(session), {
			EX: Math.max(ttl, 1), // At least 1 second
		});

		// Index by user for getByUser queries
		const userKey = `${this.keyPrefix}user:${session.userAddress}`;
		await this.redis.sAdd(userKey, sessionId);
		await this.redis.expire(userKey, ttl);
	}

	async get(sessionId: string): Promise<ShelbySession | null> {
		const key = this.keyPrefix + sessionId;
		const data = await this.redis.get(key);

		if (!data) {
			return null;
		}

		return JSON.parse(data) as ShelbySession;
	}

	async updateChunksets(sessionId: string, chunksetsRemaining: number): Promise<void> {
		const session = await this.get(sessionId);
		if (session) {
			session.chunksetsRemaining = chunksetsRemaining;
			await this.set(sessionId, session);
		}
	}

	async delete(sessionId: string): Promise<void> {
		const session = await this.get(sessionId);
		if (session) {
			const userKey = `${this.keyPrefix}user:${session.userAddress}`;
			await this.redis.sRem(userKey, sessionId);
		}

		const key = this.keyPrefix + sessionId;
		await this.redis.del(key);
	}

	async getByUser(userAddress: string): Promise<ShelbySession[]> {
		const userKey = `${this.keyPrefix}user:${userAddress}`;
		const sessionIds = await this.redis.sMembers(userKey);

		const sessions: ShelbySession[] = [];
		for (const sessionId of sessionIds) {
			const session = await this.get(sessionId);
			if (session) {
				sessions.push(session);
			}
		}

		return sessions;
	}

	async cleanExpired(): Promise<number> {
		// Redis handles expiration automatically with TTL
		// This is a no-op for Redis
		return 0;
	}
}

/**
 * PostgreSQL Session Storage
 *
 * Production-ready storage using PostgreSQL
 * Install: npm install pg
 *
 * Table schema:
 * ```sql
 * CREATE TABLE shelby_sessions (
 *   session_id VARCHAR(255) PRIMARY KEY,
 *   user_address VARCHAR(66) NOT NULL,
 *   chunksets_remaining INT NOT NULL,
 *   created_at BIGINT NOT NULL,
 *   expires_at BIGINT NOT NULL,
 *   funding_tx_hash VARCHAR(66),
 *   INDEX idx_user_address (user_address),
 *   INDEX idx_expires_at (expires_at)
 * );
 * ```
 *
 * @example
 * ```typescript
 * import { Pool } from 'pg';
 *
 * const pool = new Pool({
 *   connectionString: process.env.DATABASE_URL
 * });
 *
 * const storage = new PostgreSQLSessionStorage(pool);
 * ```
 */
export class PostgreSQLSessionStorage implements ISessionStorage {
	private pool: any; // Type as `Pool` if pg is installed

	constructor(pool: any) {
		this.pool = pool;
	}

	async set(sessionId: string, session: ShelbySession): Promise<void> {
		const query = `
			INSERT INTO shelby_sessions (
				session_id, user_address, chunksets_remaining,
				created_at, expires_at, funding_tx_hash
			) VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (session_id) DO UPDATE SET
				chunksets_remaining = $3,
				expires_at = $5
		`;

		await this.pool.query(query, [
			sessionId,
			session.userAddress,
			session.chunksetsRemaining,
			session.createdAt,
			session.expiresAt,
			session.fundingTxHash || null,
		]);
	}

	async get(sessionId: string): Promise<ShelbySession | null> {
		const query = "SELECT * FROM shelby_sessions WHERE session_id = $1";
		const result = await this.pool.query(query, [sessionId]);

		if (result.rows.length === 0) {
			return null;
		}

		const row = result.rows[0];
		return {
			sessionId: row.session_id,
			userAddress: row.user_address,
			chunksetsRemaining: row.chunksets_remaining,
			createdAt: row.created_at,
			expiresAt: row.expires_at,
			fundingTxHash: row.funding_tx_hash,
		};
	}

	async updateChunksets(sessionId: string, chunksetsRemaining: number): Promise<void> {
		const query = "UPDATE shelby_sessions SET chunksets_remaining = $1 WHERE session_id = $2";
		await this.pool.query(query, [chunksetsRemaining, sessionId]);
	}

	async delete(sessionId: string): Promise<void> {
		const query = "DELETE FROM shelby_sessions WHERE session_id = $1";
		await this.pool.query(query, [sessionId]);
	}

	async getByUser(userAddress: string): Promise<ShelbySession[]> {
		const query = "SELECT * FROM shelby_sessions WHERE user_address = $1 AND expires_at > $2";
		const result = await this.pool.query(query, [userAddress, Date.now()]);

		return result.rows.map((row: any) => ({
			sessionId: row.session_id,
			userAddress: row.user_address,
			chunksetsRemaining: row.chunksets_remaining,
			createdAt: row.created_at,
			expiresAt: row.expires_at,
			fundingTxHash: row.funding_tx_hash,
		}));
	}

	async cleanExpired(): Promise<number> {
		const query = "DELETE FROM shelby_sessions WHERE expires_at < $1 RETURNING session_id";
		const result = await this.pool.query(query, [Date.now()]);
		return result.rowCount || 0;
	}
}
