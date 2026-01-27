/**
 * GitHub Repository Analyzer
 * 
 * Fetches and analyzes GitHub repositories to extract information
 * needed for generating install.md files:
 * - README content (installation sections)
 * - package.json / pyproject.toml / Cargo.toml (dependencies, scripts)
 * - GitHub Actions workflows (build/test commands)
 * - Release information (binary downloads)
 */

export interface PackageJsonInfo {
  name: string
  version: string
  description: string
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  engines?: Record<string, string>
  bin?: Record<string, string> | string
  main?: string
  type?: string
  repository?: { type: string; url: string } | string
  homepage?: string
}

export interface PyProjectInfo {
  name: string
  version: string
  description: string
  pythonRequires?: string
  dependencies: string[]
  scripts?: Record<string, string>
}

export interface CargoTomlInfo {
  name: string
  version: string
  description: string
  edition?: string
  dependencies: Record<string, string | { version: string }>
}

export interface WorkflowStep {
  name?: string
  run?: string
  uses?: string
  with?: Record<string, string>
}

export interface GitHubWorkflow {
  name: string
  filename: string
  triggers: string[]
  jobs: Array<{
    name: string
    steps: WorkflowStep[]
  }>
}

export interface GitHubRelease {
  tagName: string
  name: string
  body: string
  prerelease: boolean
  assets: Array<{
    name: string
    downloadUrl: string
    size: number
    contentType: string
  }>
}

export interface GitHubRepoAnalysis {
  // Basic info
  owner: string
  repo: string
  fullName: string
  description: string
  homepage: string | null
  defaultBranch: string
  language: string | null
  topics: string[]
  stars: number
  
  // README content
  readme: {
    content: string
    installationSection: string | null
    usageSection: string | null
    prerequisitesSection: string | null
    quickstartSection: string | null
  }
  
  // Package files
  packageJson: PackageJsonInfo | null
  pyProjectToml: PyProjectInfo | null
  cargoToml: CargoTomlInfo | null
  
  // CI/CD
  workflows: GitHubWorkflow[]
  
  // Releases
  latestRelease: GitHubRelease | null
  
  // Detection results
  projectType: 'node' | 'python' | 'rust' | 'go' | 'unknown'
  hasCli: boolean
  installMethods: Array<{
    method: string
    command: string
    packageManager?: string
  }>
  
  // Raw data for AI synthesis
  rawFiles: Record<string, string>
}

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Parse a GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Support formats:
  // - https://github.com/owner/repo
  // - github.com/owner/repo
  // - owner/repo
  // - https://github.com/owner/repo.git
  // - https://github.com/owner/repo/tree/branch
  
  let normalized = url.trim()
  
  // Remove .git suffix
  normalized = normalized.replace(/\.git$/, '')
  
  // Handle full URLs
  const urlMatch = normalized.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/)
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] }
  }
  
  // Handle owner/repo format
  const shortMatch = normalized.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] }
  }
  
  return null
}

/**
 * Fetch with timeout and error handling
 */
async function fetchGitHub(
  url: string,
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'llm-energy-install-md-generator',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Fetch raw file content from GitHub
 */
async function fetchRawFile(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main',
  token?: string
): Promise<string | null> {
  // Try raw.githubusercontent.com first (no rate limit)
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  
  try {
    const response = await fetch(rawUrl, {
      headers: { 'User-Agent': 'llm-energy-install-md-generator' },
    })
    
    if (response.ok) {
      return await response.text()
    }
  } catch {
    // Fall through to API
  }
  
  // Fallback to API
  const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  
  try {
    const response = await fetchGitHub(apiUrl, token)
    if (!response.ok) return null
    
    const data = await response.json()
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }
  } catch {
    return null
  }
  
  return null
}

/**
 * Extract sections from README content
 */
function extractReadmeSections(readme: string): {
  installationSection: string | null
  usageSection: string | null
  prerequisitesSection: string | null
  quickstartSection: string | null
} {
  const sections: Record<string, string | null> = {
    installationSection: null,
    usageSection: null,
    prerequisitesSection: null,
    quickstartSection: null,
  }
  
  // Section header patterns
  const patterns = {
    installationSection: /^#{1,3}\s*(install(?:ation)?|getting\s+started|setup|quick\s*start)/im,
    usageSection: /^#{1,3}\s*(usage|how\s+to\s+use|using|examples?)/im,
    prerequisitesSection: /^#{1,3}\s*(prerequisites?|requirements?|dependencies|before\s+you\s+begin)/im,
    quickstartSection: /^#{1,3}\s*(quick\s*start|tldr|quick\s+setup|5\s*minute)/im,
  }
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = readme.match(pattern)
    if (match && match.index !== undefined) {
      // Find the next section header or end of file
      const startIndex = match.index
      const afterHeader = readme.slice(startIndex + match[0].length)
      const nextHeaderMatch = afterHeader.match(/^#{1,3}\s+[A-Z]/m)
      const endIndex = nextHeaderMatch && nextHeaderMatch.index !== undefined
        ? startIndex + match[0].length + nextHeaderMatch.index
        : undefined
      
      sections[key] = readme.slice(startIndex, endIndex).trim()
    }
  }
  
  return sections as {
    installationSection: string | null
    usageSection: string | null
    prerequisitesSection: string | null
    quickstartSection: string | null
  }
}

/**
 * Parse package.json content
 */
function parsePackageJson(content: string): PackageJsonInfo | null {
  try {
    const pkg = JSON.parse(content)
    return {
      name: pkg.name || '',
      version: pkg.version || '',
      description: pkg.description || '',
      scripts: pkg.scripts || {},
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      engines: pkg.engines,
      bin: pkg.bin,
      main: pkg.main,
      type: pkg.type,
      repository: pkg.repository,
      homepage: pkg.homepage,
    }
  } catch {
    return null
  }
}

/**
 * Parse pyproject.toml content (basic parsing without TOML library)
 */
function parsePyProjectToml(content: string): PyProjectInfo | null {
  try {
    // Extract basic info with regex (simplified parsing)
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/)
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/)
    const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/)
    const pythonMatch = content.match(/requires-python\s*=\s*["']([^"']+)["']/)
    
    // Extract dependencies array
    const depsMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)
    const deps: string[] = []
    if (depsMatch) {
      const depStrings = depsMatch[1].match(/["']([^"']+)["']/g)
      if (depStrings) {
        deps.push(...depStrings.map(s => s.replace(/["']/g, '')))
      }
    }
    
    return {
      name: nameMatch?.[1] || '',
      version: versionMatch?.[1] || '',
      description: descMatch?.[1] || '',
      pythonRequires: pythonMatch?.[1],
      dependencies: deps,
    }
  } catch {
    return null
  }
}

/**
 * Parse Cargo.toml content (basic parsing without TOML library)
 */
function parseCargoToml(content: string): CargoTomlInfo | null {
  try {
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/)
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/)
    const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/)
    const editionMatch = content.match(/edition\s*=\s*["']([^"']+)["']/)
    
    return {
      name: nameMatch?.[1] || '',
      version: versionMatch?.[1] || '',
      description: descMatch?.[1] || '',
      edition: editionMatch?.[1],
      dependencies: {}, // Would need full TOML parser for proper extraction
    }
  } catch {
    return null
  }
}

/**
 * Parse GitHub Actions workflow file
 */
function parseWorkflow(filename: string, content: string): GitHubWorkflow | null {
  try {
    // Basic YAML parsing without library
    const nameMatch = content.match(/^name:\s*['"]?([^'"\n]+)['"]?/m)
    const name = nameMatch?.[1] || filename.replace('.yml', '').replace('.yaml', '')
    
    // Extract triggers
    const triggers: string[] = []
    const onMatch = content.match(/^on:\s*\n([\s\S]*?)(?=\njobs:|$)/m)
    if (onMatch) {
      const triggerMatches = onMatch[1].matchAll(/^\s+(\w+):/gm)
      for (const match of Array.from(triggerMatches)) {
        triggers.push(match[1])
      }
    }
    
    // Extract jobs and steps (simplified)
    const jobs: GitHubWorkflow['jobs'] = []
    const jobsMatch = content.match(/^jobs:\s*\n([\s\S]*)/m)
    if (jobsMatch) {
      const jobMatches = jobsMatch[1].matchAll(/^\s{2}(\w+):\s*\n([\s\S]*?)(?=\n\s{2}\w+:|$)/gm)
      for (const match of Array.from(jobMatches)) {
        const jobName = match[1]
        const jobContent = match[2]
        
        const steps: WorkflowStep[] = []
        const runMatches = jobContent.matchAll(/^\s+-\s+(?:name:\s*['"]?([^'"\n]+)['"]?\s+)?run:\s*\|?\s*\n?\s*(.*?)(?=\n\s+-|\n\s{2}\w+:|$)/gm)
        for (const runMatch of Array.from(runMatches)) {
          steps.push({
            name: runMatch[1] || undefined,
            run: runMatch[2]?.trim(),
          })
        }
        
        jobs.push({ name: jobName, steps })
      }
    }
    
    return { name, filename, triggers, jobs }
  } catch {
    return null
  }
}

/**
 * Detect project type and installation methods
 */
function detectInstallMethods(
  packageJson: PackageJsonInfo | null,
  pyProject: PyProjectInfo | null,
  cargoToml: CargoTomlInfo | null,
  readme: string
): {
  projectType: GitHubRepoAnalysis['projectType']
  hasCli: boolean
  installMethods: GitHubRepoAnalysis['installMethods']
} {
  const installMethods: GitHubRepoAnalysis['installMethods'] = []
  let projectType: GitHubRepoAnalysis['projectType'] = 'unknown'
  let hasCli = false
  
  // Node.js project
  if (packageJson) {
    projectType = 'node'
    
    // Check for CLI
    if (packageJson.bin) {
      hasCli = true
      installMethods.push({
        method: 'npm global',
        command: `npm install -g ${packageJson.name}`,
        packageManager: 'npm',
      })
      installMethods.push({
        method: 'pnpm global',
        command: `pnpm add -g ${packageJson.name}`,
        packageManager: 'pnpm',
      })
      installMethods.push({
        method: 'yarn global',
        command: `yarn global add ${packageJson.name}`,
        packageManager: 'yarn',
      })
      installMethods.push({
        method: 'npx (no install)',
        command: `npx ${packageJson.name}`,
        packageManager: 'npx',
      })
    } else {
      // Library
      installMethods.push({
        method: 'npm',
        command: `npm install ${packageJson.name}`,
        packageManager: 'npm',
      })
      installMethods.push({
        method: 'pnpm',
        command: `pnpm add ${packageJson.name}`,
        packageManager: 'pnpm',
      })
      installMethods.push({
        method: 'yarn',
        command: `yarn add ${packageJson.name}`,
        packageManager: 'yarn',
      })
    }
  }
  
  // Python project
  if (pyProject) {
    projectType = 'python'
    installMethods.push({
      method: 'pip',
      command: `pip install ${pyProject.name}`,
      packageManager: 'pip',
    })
    installMethods.push({
      method: 'pipx (isolated)',
      command: `pipx install ${pyProject.name}`,
      packageManager: 'pipx',
    })
    installMethods.push({
      method: 'uv',
      command: `uv pip install ${pyProject.name}`,
      packageManager: 'uv',
    })
    
    // Check for CLI scripts
    if (pyProject.scripts && Object.keys(pyProject.scripts).length > 0) {
      hasCli = true
    }
  }
  
  // Rust project
  if (cargoToml) {
    projectType = 'rust'
    hasCli = true // Most Rust crates with Cargo.toml are CLIs
    installMethods.push({
      method: 'cargo install',
      command: `cargo install ${cargoToml.name}`,
      packageManager: 'cargo',
    })
  }
  
  // Check README for additional install methods
  const curlMatch = readme.match(/curl\s+[^\n]*(?:install|setup|get)[^\n]*/i)
  if (curlMatch) {
    installMethods.push({
      method: 'curl script',
      command: curlMatch[0],
    })
  }
  
  const brewMatch = readme.match(/brew\s+install\s+([^\s\n]+)/i)
  if (brewMatch) {
    installMethods.push({
      method: 'Homebrew',
      command: `brew install ${brewMatch[1]}`,
      packageManager: 'homebrew',
    })
  }
  
  const aptMatch = readme.match(/apt(?:-get)?\s+install\s+([^\s\n]+)/i)
  if (aptMatch) {
    installMethods.push({
      method: 'apt',
      command: `apt install ${aptMatch[1]}`,
      packageManager: 'apt',
    })
  }
  
  return { projectType, hasCli, installMethods }
}

/**
 * Analyze a GitHub repository
 */
export async function analyzeGitHubRepo(
  url: string,
  token?: string
): Promise<GitHubRepoAnalysis> {
  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    throw new Error('Invalid GitHub URL')
  }
  
  const { owner, repo } = parsed
  
  // Fetch repository metadata
  const repoResponse = await fetchGitHub(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
    token
  )
  
  if (!repoResponse.ok) {
    if (repoResponse.status === 404) {
      throw new Error('Repository not found')
    }
    if (repoResponse.status === 403) {
      throw new Error('Rate limit exceeded. Try again later or provide a GitHub token.')
    }
    throw new Error(`GitHub API error: ${repoResponse.status}`)
  }
  
  const repoData = await repoResponse.json()
  const defaultBranch = repoData.default_branch || 'main'
  
  // Fetch files in parallel
  const [
    readmeContent,
    packageJsonContent,
    pyProjectContent,
    cargoTomlContent,
    setupPyContent,
    requirementsContent,
    makefileContent,
    dockerfileContent,
  ] = await Promise.all([
    // Try multiple README locations
    fetchRawFile(owner, repo, 'README.md', defaultBranch, token)
      .then(r => r || fetchRawFile(owner, repo, 'readme.md', defaultBranch, token))
      .then(r => r || fetchRawFile(owner, repo, 'Readme.md', defaultBranch, token))
      .then(r => r || ''),
    fetchRawFile(owner, repo, 'package.json', defaultBranch, token),
    fetchRawFile(owner, repo, 'pyproject.toml', defaultBranch, token),
    fetchRawFile(owner, repo, 'Cargo.toml', defaultBranch, token),
    fetchRawFile(owner, repo, 'setup.py', defaultBranch, token),
    fetchRawFile(owner, repo, 'requirements.txt', defaultBranch, token),
    fetchRawFile(owner, repo, 'Makefile', defaultBranch, token),
    fetchRawFile(owner, repo, 'Dockerfile', defaultBranch, token),
  ])
  
  // Fetch workflows
  const workflows: GitHubWorkflow[] = []
  try {
    const workflowsResponse = await fetchGitHub(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/.github/workflows`,
      token
    )
    if (workflowsResponse.ok) {
      const workflowFiles = await workflowsResponse.json()
      if (Array.isArray(workflowFiles)) {
        for (const file of workflowFiles.slice(0, 5)) { // Limit to 5 workflows
          if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
            const content = await fetchRawFile(
              owner, repo,
              `.github/workflows/${file.name}`,
              defaultBranch,
              token
            )
            if (content) {
              const workflow = parseWorkflow(file.name, content)
              if (workflow) workflows.push(workflow)
            }
          }
        }
      }
    }
  } catch {
    // Ignore workflow errors
  }
  
  // Fetch latest release
  let latestRelease: GitHubRelease | null = null
  try {
    const releaseResponse = await fetchGitHub(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`,
      token
    )
    if (releaseResponse.ok) {
      const releaseData = await releaseResponse.json()
      latestRelease = {
        tagName: releaseData.tag_name,
        name: releaseData.name || releaseData.tag_name,
        body: releaseData.body || '',
        prerelease: releaseData.prerelease,
        assets: (releaseData.assets || []).map((asset: {
          name: string
          browser_download_url: string
          size: number
          content_type: string
        }) => ({
          name: asset.name,
          downloadUrl: asset.browser_download_url,
          size: asset.size,
          contentType: asset.content_type,
        })),
      }
    }
  } catch {
    // Ignore release errors
  }
  
  // Parse package files
  const packageJson = packageJsonContent ? parsePackageJson(packageJsonContent) : null
  const pyProjectToml = pyProjectContent ? parsePyProjectToml(pyProjectContent) : null
  const cargoToml = cargoTomlContent ? parseCargoToml(cargoTomlContent) : null
  
  // Extract README sections
  const readmeSections = extractReadmeSections(readmeContent)
  
  // Detect install methods
  const { projectType, hasCli, installMethods } = detectInstallMethods(
    packageJson,
    pyProjectToml,
    cargoToml,
    readmeContent
  )
  
  // Build raw files map
  const rawFiles: Record<string, string> = {}
  if (readmeContent) rawFiles['README.md'] = readmeContent
  if (packageJsonContent) rawFiles['package.json'] = packageJsonContent
  if (pyProjectContent) rawFiles['pyproject.toml'] = pyProjectContent
  if (cargoTomlContent) rawFiles['Cargo.toml'] = cargoTomlContent
  if (setupPyContent) rawFiles['setup.py'] = setupPyContent
  if (requirementsContent) rawFiles['requirements.txt'] = requirementsContent
  if (makefileContent) rawFiles['Makefile'] = makefileContent
  if (dockerfileContent) rawFiles['Dockerfile'] = dockerfileContent
  
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    description: repoData.description || '',
    homepage: repoData.homepage || null,
    defaultBranch,
    language: repoData.language,
    topics: repoData.topics || [],
    stars: repoData.stargazers_count || 0,
    
    readme: {
      content: readmeContent,
      ...readmeSections,
    },
    
    packageJson,
    pyProjectToml,
    cargoToml,
    
    workflows,
    latestRelease,
    
    projectType,
    hasCli,
    installMethods,
    
    rawFiles,
  }
}

/**
 * Generate a prompt for AI to create install.md from analysis
 */
export function generateInstallMdPrompt(analysis: GitHubRepoAnalysis): string {
  const parts: string[] = []
  
  parts.push(`Generate an install.md file for ${analysis.fullName}.`)
  parts.push('')
  parts.push('## Repository Information')
  parts.push(`- Name: ${analysis.repo}`)
  parts.push(`- Description: ${analysis.description || 'No description'}`)
  parts.push(`- Language: ${analysis.language || 'Unknown'}`)
  parts.push(`- Project Type: ${analysis.projectType}`)
  parts.push(`- Has CLI: ${analysis.hasCli ? 'Yes' : 'No'}`)
  if (analysis.homepage) parts.push(`- Homepage: ${analysis.homepage}`)
  if (analysis.topics.length > 0) parts.push(`- Topics: ${analysis.topics.join(', ')}`)
  parts.push('')
  
  if (analysis.installMethods.length > 0) {
    parts.push('## Detected Installation Methods')
    for (const method of analysis.installMethods) {
      parts.push(`- ${method.method}: \`${method.command}\``)
    }
    parts.push('')
  }
  
  // Include relevant package info
  if (analysis.packageJson) {
    parts.push('## package.json')
    parts.push('```json')
    parts.push(JSON.stringify({
      name: analysis.packageJson.name,
      version: analysis.packageJson.version,
      description: analysis.packageJson.description,
      bin: analysis.packageJson.bin,
      engines: analysis.packageJson.engines,
      scripts: analysis.packageJson.scripts,
    }, null, 2))
    parts.push('```')
    parts.push('')
  }
  
  if (analysis.pyProjectToml) {
    parts.push('## pyproject.toml info')
    parts.push(`- Name: ${analysis.pyProjectToml.name}`)
    parts.push(`- Version: ${analysis.pyProjectToml.version}`)
    if (analysis.pyProjectToml.pythonRequires) {
      parts.push(`- Python requires: ${analysis.pyProjectToml.pythonRequires}`)
    }
    parts.push('')
  }
  
  if (analysis.cargoToml) {
    parts.push('## Cargo.toml info')
    parts.push(`- Name: ${analysis.cargoToml.name}`)
    parts.push(`- Version: ${analysis.cargoToml.version}`)
    if (analysis.cargoToml.edition) {
      parts.push(`- Edition: ${analysis.cargoToml.edition}`)
    }
    parts.push('')
  }
  
  // Include README installation section
  if (analysis.readme.installationSection) {
    parts.push('## README Installation Section')
    parts.push(analysis.readme.installationSection.slice(0, 3000))
    parts.push('')
  } else if (analysis.readme.quickstartSection) {
    parts.push('## README Quickstart Section')
    parts.push(analysis.readme.quickstartSection.slice(0, 3000))
    parts.push('')
  } else if (analysis.readme.content) {
    parts.push('## README (truncated)')
    parts.push(analysis.readme.content.slice(0, 3000))
    parts.push('')
  }
  
  // Include latest release info
  if (analysis.latestRelease) {
    parts.push('## Latest Release')
    parts.push(`- Version: ${analysis.latestRelease.tagName}`)
    if (analysis.latestRelease.assets.length > 0) {
      parts.push('- Assets:')
      for (const asset of analysis.latestRelease.assets.slice(0, 5)) {
        parts.push(`  - ${asset.name}`)
      }
    }
    parts.push('')
  }
  
  // Include CI workflow info
  if (analysis.workflows.length > 0) {
    parts.push('## CI Workflows')
    for (const workflow of analysis.workflows) {
      parts.push(`### ${workflow.name}`)
      for (const job of workflow.jobs) {
        const buildSteps = job.steps
          .filter(s => s.run)
          .map(s => s.run)
          .join('\n')
        if (buildSteps) {
          parts.push('```bash')
          parts.push(buildSteps)
          parts.push('```')
        }
      }
    }
    parts.push('')
  }
  
  return parts.join('\n')
}
