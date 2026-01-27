/**
 * @fileoverview Index of popular pre-built MCP server entries
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import type { RegistryEntry } from '../types';

// Import all popular entries
import stripeEntry from './stripe.json';
import githubEntry from './github.json';
import notionEntry from './notion.json';
import slackEntry from './slack.json';
import openaiEntry from './openai.json';
import twilioEntry from './twilio.json';
import supabaseEntry from './supabase.json';
import vercelEntry from './vercel.json';
import linearEntry from './linear.json';
import resendEntry from './resend.json';

/**
 * All popular pre-built entries
 */
export const popularEntries: RegistryEntry[] = [
  stripeEntry as RegistryEntry,
  githubEntry as RegistryEntry,
  notionEntry as RegistryEntry,
  slackEntry as RegistryEntry,
  openaiEntry as RegistryEntry,
  twilioEntry as RegistryEntry,
  supabaseEntry as RegistryEntry,
  vercelEntry as RegistryEntry,
  linearEntry as RegistryEntry,
  resendEntry as RegistryEntry,
];

/**
 * Get a specific popular entry by ID
 */
export function getPopularEntry(id: string): RegistryEntry | undefined {
  return popularEntries.find(e => e.id === id);
}

/**
 * Get all categories from popular entries
 */
export function getPopularCategories(): string[] {
  const categories = new Set<string>();
  for (const entry of popularEntries) {
    for (const cat of entry.categories) {
      categories.add(cat);
    }
  }
  return Array.from(categories).sort();
}
