export type VerificationStatus = 'unknown' | 'checking' | 'online' | 'offline' | 'error'

export interface LlmsTxtInfo {
  exists: boolean
  url?: string
  size?: number
  lastModified?: string
  type?: 'full' | 'standard'
}

export interface VerificationResult {
  status: VerificationStatus
  llmsTxt?: LlmsTxtInfo
  llmsFullTxt?: LlmsTxtInfo
  installMd?: { exists: boolean; url?: string }
  responseTime?: number
  checkedAt: string
  error?: string
}

export interface SiteEntry {
  id: string
  name: string
  url: string
  /** The actual URL where llms.txt is served (may differ from docs URL) */
  llmsTxtUrl?: string
  category: 'ai' | 'developer-tools' | 'documentation' | 'cloud' | 'other'
  description: string
  llmsTxtType: 'full' | 'standard'
  /** @deprecated Use verification.status instead */
  verified: boolean
  lastChecked?: string
  favicon?: string
  hasInstallMd?: boolean
  /** Real-time verification result - populated by API */
  verification?: VerificationResult
}

export const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'Globe' },
  { id: 'ai', label: 'AI', icon: 'Brain' },
  { id: 'developer-tools', label: 'Developer Tools', icon: 'Code' },
  { id: 'documentation', label: 'Documentation', icon: 'BookOpen' },
  { id: 'cloud', label: 'Cloud', icon: 'Cloud' },
  { id: 'other', label: 'Other', icon: 'Layers' },
] as const

export type CategoryId = typeof CATEGORIES[number]['id']

export const KNOWN_SITES: SiteEntry[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    url: 'https://docs.anthropic.com',
    llmsTxtUrl: 'https://docs.anthropic.com',
    category: 'ai',
    description: 'Claude AI documentation and API reference',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://docs.stripe.com',
    llmsTxtUrl: 'https://docs.stripe.com',
    category: 'developer-tools',
    description: 'Payment processing API documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    url: 'https://vercel.com/docs',
    llmsTxtUrl: 'https://vercel.com',
    category: 'cloud',
    description: 'Frontend cloud platform documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    url: 'https://supabase.com/docs',
    llmsTxtUrl: 'https://supabase.com',
    category: 'cloud',
    description: 'Open source Firebase alternative documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://platform.openai.com/docs',
    llmsTxtUrl: 'https://platform.openai.com',
    category: 'ai',
    description: 'GPT models and API documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'langchain',
    name: 'LangChain',
    url: 'https://python.langchain.com/docs',
    llmsTxtUrl: 'https://python.langchain.com',
    category: 'ai',
    description: 'LLM application framework documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
    hasInstallMd: true,
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    url: 'https://nextjs.org/docs',
    llmsTxtUrl: 'https://nextjs.org',
    category: 'developer-tools',
    description: 'React framework documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com/docs',
    llmsTxtUrl: 'https://tailwindcss.com',
    category: 'developer-tools',
    description: 'Utility-first CSS framework documentation',
    llmsTxtType: 'standard',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'prisma',
    name: 'Prisma',
    url: 'https://www.prisma.io/docs',
    llmsTxtUrl: 'https://www.prisma.io',
    category: 'developer-tools',
    description: 'Node.js and TypeScript ORM documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    url: 'https://developers.cloudflare.com',
    llmsTxtUrl: 'https://developers.cloudflare.com',
    category: 'cloud',
    description: 'CDN and edge computing documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'clerk',
    name: 'Clerk',
    url: 'https://clerk.com/docs',
    llmsTxtUrl: 'https://clerk.com',
    category: 'developer-tools',
    description: 'Authentication and user management docs',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'resend',
    name: 'Resend',
    url: 'https://resend.com/docs',
    llmsTxtUrl: 'https://resend.com',
    category: 'developer-tools',
    description: 'Email API for developers',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    url: 'https://huggingface.co/docs',
    llmsTxtUrl: 'https://huggingface.co',
    category: 'ai',
    description: 'ML models and transformers documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    url: 'https://replicate.com/docs',
    llmsTxtUrl: 'https://replicate.com',
    category: 'ai',
    description: 'Run ML models in the cloud',
    llmsTxtType: 'standard',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'railway',
    name: 'Railway',
    url: 'https://docs.railway.app',
    llmsTxtUrl: 'https://docs.railway.app',
    category: 'cloud',
    description: 'Infrastructure platform documentation',
    llmsTxtType: 'standard',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'mintlify',
    name: 'Mintlify',
    url: 'https://mintlify.com/docs',
    llmsTxtUrl: 'https://mintlify.com',
    category: 'documentation',
    description: 'Documentation platform for developers',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'readme',
    name: 'ReadMe',
    url: 'https://docs.readme.com',
    llmsTxtUrl: 'https://docs.readme.com',
    category: 'documentation',
    description: 'Interactive API documentation platform',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'lighter',
    name: 'Lighter',
    url: 'https://docs.lighter.xyz',
    llmsTxtUrl: 'https://docs.lighter.xyz',
    category: 'developer-tools',
    description: 'Decentralized exchange documentation',
    llmsTxtType: 'full',
    verified: true,
    lastChecked: '2026-01-17',
  },
  {
    id: 'ucai',
    name: 'UCAI',
    url: 'https://ucai.tech',
    llmsTxtUrl: 'https://ucai.tech',
    category: 'ai',
    description: 'AI technology platform',
    llmsTxtType: 'standard',
    verified: true,
    lastChecked: '2026-01-17',
  },
]
