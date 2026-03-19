export interface SkillDefinition {
  name: string;
  description: string;
  price?: string;            // "$0.50" — omit for free
  method?: 'GET' | 'POST';  // default POST
  handler: 'webhook' | 'script' | 'placeholder';
  webhook?: string;
  script?: string;
  tags?: string[];
}

export interface SkillsConfig {
  skills: Record<string, Omit<SkillDefinition, 'name'>>;
}
