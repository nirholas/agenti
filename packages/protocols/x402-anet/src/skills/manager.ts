import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { ANET_HOME } from '../config.js';
import type { SkillDefinition, SkillsConfig } from './types.js';
import type { RoutePrice } from '../core/payments/server.js';
import type { ServiceEntry } from '../core/registry/metadata.js';

const DEFAULT_SKILLS: SkillsConfig = {
  skills: {},
};

export class SkillsManager {
  private filePath: string;
  private data: SkillsConfig;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(ANET_HOME, 'skills.yaml');
    this.data = this.load();
  }

  private load(): SkillsConfig {
    if (!fs.existsSync(this.filePath)) return { ...DEFAULT_SKILLS, skills: {} };
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const parsed = yaml.load(raw) as SkillsConfig | null;
    if (!parsed || !parsed.skills) return { ...DEFAULT_SKILLS, skills: {} };
    return parsed;
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, yaml.dump(this.data, { lineWidth: -1 }));
  }

  list(): SkillDefinition[] {
    return Object.entries(this.data.skills).map(([name, def]) => ({
      name,
      ...def,
    }));
  }

  get(name: string): SkillDefinition | undefined {
    const def = this.data.skills[name];
    if (!def) return undefined;
    return { name, ...def };
  }

  add(skill: SkillDefinition): void {
    const { name, ...rest } = skill;
    this.data.skills[name] = rest;
    this.save();
  }

  remove(name: string): boolean {
    if (!this.data.skills[name]) return false;
    delete this.data.skills[name];
    this.save();
    return true;
  }

  /**
   * Convert skills with prices to X402 route config for createPaymentMiddleware().
   */
  toRouteConfig(network: string): Record<string, RoutePrice> {
    const routes: Record<string, RoutePrice> = {};
    for (const skill of this.list()) {
      if (skill.price) {
        const method = skill.method || 'POST';
        routes[`${method} /api/${skill.name}`] = {
          price: skill.price,
          network,
        };
      }
    }
    return routes;
  }

  /**
   * Convert skills to ERC-8004 ServiceEntry[] for on-chain metadata.
   */
  toServiceEntries(baseUrl: string): ServiceEntry[] {
    return this.list().map(skill => ({
      name: skill.name,
      endpoint: `${baseUrl}/api/${skill.name}`,
      version: skill.price || 'free',
    }));
  }

  /**
   * Extract capability tags from all skills.
   */
  toCapabilities(): string[] {
    const caps = new Set<string>();
    for (const skill of this.list()) {
      caps.add(skill.name);
      if (skill.tags) {
        for (const tag of skill.tags) caps.add(tag);
      }
    }
    return [...caps];
  }

  /**
   * SHA-256 content hash for change detection.
   * Used by `anet up` to know if on-chain metadata needs updating.
   */
  hash(): string {
    const content = JSON.stringify(this.data.skills);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create default skills.yaml with comments.
   */
  static initDefaults(home: string): void {
    const skillsPath = path.join(home, 'skills.yaml');
    if (!fs.existsSync(skillsPath)) {
      const content = `# anet skills configuration
# Define what your agent can do. Each skill becomes an API endpoint.
#
# Example:
#   skills:
#     code-review:
#       description: "Review code for bugs and security"
#       price: "$0.50"
#       handler: placeholder
#       tags: [code, security]
#
# Handler types:
#   placeholder — built-in stub (for testing)
#   webhook     — forward to a URL (set webhook: "http://...")
#   script      — run a script (set script: "./my-handler.sh")

skills: {}
`;
      fs.writeFileSync(skillsPath, content);
    }
  }
}
