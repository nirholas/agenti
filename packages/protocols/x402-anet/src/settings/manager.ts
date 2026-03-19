import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ANET_HOME } from '../config.js';
import { SkillsManager } from '../skills/manager.js';

export interface AnetConfig {
  agent: { name: string; port: number };
  network: string;
  signing: {
    policy: 'always' | 'prompt' | 'never';
    'domain-whitelist': string[];
    'max-value-auto': number;
  };
  social: {
    'min-friend-rep': number;
    'auto-accept-friends': boolean;
    'default-room-min-rep': number;
  };
  messaging: {
    webhook: string;
    'rate-limit': number;
    'text-webhook': string;
    'text-script': string;
  };
  payments: {
    'max-per-tx': number;
    'max-per-session': number;
    currency: string;
  };
  reputation: {
    'auto-feedback': boolean;
  };
  discovery: {
    'sync-interval': number;
    'auto-sync': boolean;
  };
  [key: string]: any;
}

const DEFAULT_CONFIG: AnetConfig = {
  agent: { name: 'my-agent', port: 3000 },
  network: 'testnet',
  signing: {
    policy: 'prompt',
    'domain-whitelist': [],
    'max-value-auto': 0.10,
  },
  social: {
    'min-friend-rep': 50,
    'auto-accept-friends': false,
    'default-room-min-rep': 30,
  },
  messaging: {
    webhook: '',
    'rate-limit': 10,
    'text-webhook': '',
    'text-script': '',
  },
  payments: {
    'max-per-tx': 1.00,
    'max-per-session': 10.00,
    currency: 'USDC',
  },
  reputation: {
    'auto-feedback': true,
  },
  discovery: {
    'sync-interval': 3600,
    'auto-sync': true,
  },
};

const DEFAULT_HOOKS = {
  hooks: {
    'pre-message': [
      { action: 'rate-limit' },
      { action: 'reputation-check', config: { 'min-reputation': 30 } },
    ],
    'post-interaction': [
      { action: 'log', config: { file: '~/.anet/interactions.jsonl' } },
    ],
    'pre-sign': [
      { action: 'budget-check' },
      { action: 'domain-whitelist' },
    ],
    'post-payment': [
      { action: 'log' },
    ],
  },
};

export class SettingsManager {
  private configPath: string;
  private hooksPath: string;
  private config: AnetConfig;

  constructor(configPath?: string, hooksPath?: string) {
    this.configPath = configPath || path.join(ANET_HOME, 'config.yaml');
    this.hooksPath = hooksPath || path.join(ANET_HOME, 'hooks.yaml');
    this.config = this.load();
  }

  private load(): AnetConfig {
    if (!fs.existsSync(this.configPath)) return { ...DEFAULT_CONFIG };
    const raw = fs.readFileSync(this.configPath, 'utf8');
    const parsed = yaml.load(raw) as Partial<AnetConfig>;
    return this.merge(DEFAULT_CONFIG, parsed || {});
  }

  private merge(defaults: any, overrides: any): any {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
      if (
        typeof defaults[key] === 'object' &&
        defaults[key] !== null &&
        !Array.isArray(defaults[key]) &&
        typeof overrides[key] === 'object' &&
        overrides[key] !== null &&
        !Array.isArray(overrides[key])
      ) {
        result[key] = this.merge(defaults[key], overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
    return result;
  }

  get(key: string): any {
    const parts = key.split('.');
    let current: any = this.config;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }

  set(key: string, value: any): void {
    const parts = key.split('.');
    let current: any = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    // Parse value types
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (!isNaN(Number(value)) && value !== '') value = Number(value);

    current[parts[parts.length - 1]] = value;
    this.save();
  }

  getAll(): AnetConfig {
    return this.config;
  }

  save(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, yaml.dump(this.config, { lineWidth: -1 }));
  }

  // Hooks management
  loadHooks(): any {
    if (!fs.existsSync(this.hooksPath)) return { ...DEFAULT_HOOKS };
    const raw = fs.readFileSync(this.hooksPath, 'utf8');
    return (yaml.load(raw) as any) || { ...DEFAULT_HOOKS };
  }

  saveHooks(hooks: any): void {
    const dir = path.dirname(this.hooksPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.hooksPath, yaml.dump(hooks, { lineWidth: -1 }));
  }

  // Initialize with defaults
  static initDefaults(home: string): void {
    const configPath = path.join(home, 'config.yaml');
    const hooksPath = path.join(home, 'hooks.yaml');

    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, yaml.dump(DEFAULT_CONFIG, { lineWidth: -1 }));
    }
    if (!fs.existsSync(hooksPath)) {
      fs.writeFileSync(hooksPath, yaml.dump(DEFAULT_HOOKS, { lineWidth: -1 }));
    }

    SkillsManager.initDefaults(home);
  }
}
