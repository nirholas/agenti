"""
Tool Analyzer - AI-powered analysis of discovered MCP repositories.

Uses AI to analyze discovered repositories and extract:
- Tool names and descriptions
- Input schemas
- Categories and tags
- Required chains
- Quality scores
"""

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from enum import Enum

logger = logging.getLogger(__name__)


class ToolCategory(Enum):
    """Categories for MCP tools."""
    MARKET_DATA = "market_data"
    PORTFOLIO = "portfolio"
    TRADING = "trading"
    DEFI = "defi"
    NFT = "nft"
    SECURITY = "security"
    BRIDGE = "bridge"
    WALLET = "wallet"
    ANALYTICS = "analytics"
    SOCIAL = "social"
    GOVERNANCE = "governance"
    STAKING = "staking"
    LENDING = "lending"
    YIELD = "yield"
    DEX = "dex"
    CEX = "cex"
    ORACLE = "oracle"
    UTILITY = "utility"
    UNKNOWN = "unknown"


@dataclass
class ExtractedTool:
    """Represents an extracted tool from a repository."""
    name: str
    description: str
    category: ToolCategory
    input_schema: Dict[str, Any]
    file_path: str
    chains: List[str] = field(default_factory=list)
    requires_api_key: bool = False
    api_key_env_var: Optional[str] = None
    example_input: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "input_schema": self.input_schema,
            "file_path": self.file_path,
            "chains": self.chains,
            "requires_api_key": self.requires_api_key,
            "api_key_env_var": self.api_key_env_var,
            "example_input": self.example_input,
        }


@dataclass 
class AnalyzedTool:
    """Complete analyzed tool from a repository."""
    
    # Source info
    repo_full_name: str
    repo_url: str
    
    # Extracted tools
    tools: List[ExtractedTool]
    
    # Overall analysis
    total_tools: int
    categories_found: List[str]
    chains_supported: List[str]
    requires_api_keys: bool
    
    # Quality metrics
    quality_score: float  # 0-100
    documentation_score: float  # 0-100
    security_score: float  # 0-100
    
    # Issues found
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # Metadata
    analyzed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ai_model_used: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "repo_full_name": self.repo_full_name,
            "repo_url": self.repo_url,
            "tools": [t.to_dict() for t in self.tools],
            "total_tools": self.total_tools,
            "categories_found": self.categories_found,
            "chains_supported": self.chains_supported,
            "requires_api_keys": self.requires_api_keys,
            "quality_score": self.quality_score,
            "documentation_score": self.documentation_score,
            "security_score": self.security_score,
            "issues": self.issues,
            "warnings": self.warnings,
            "analyzed_at": self.analyzed_at.isoformat(),
            "ai_model_used": self.ai_model_used,
        }


@dataclass
class ToolAnalysisConfig:
    """Configuration for tool analysis."""
    
    # AI provider settings
    ai_provider: str = "openai"  # openai, anthropic, local
    ai_model: str = "gpt-4"
    api_key: Optional[str] = None
    
    # Analysis settings
    max_file_size: int = 100_000  # Max file size to analyze (bytes)
    extract_examples: bool = True
    infer_schemas: bool = True
    
    # Security settings
    check_security: bool = True
    security_patterns: List[str] = field(default_factory=lambda: [
        r"eval\s*\(",
        r"exec\s*\(",
        r"__import__\s*\(",
        r"subprocess\.",
        r"os\.system\s*\(",
        r"shell\s*=\s*True",
    ])
    
    # Clone settings
    clone_timeout: int = 60  # seconds
    clone_depth: int = 1
    
    def __post_init__(self):
        if not self.api_key:
            if self.ai_provider == "openai":
                self.api_key = os.environ.get("OPENAI_API_KEY")
            elif self.ai_provider == "anthropic":
                self.api_key = os.environ.get("ANTHROPIC_API_KEY")


# Prompts for AI analysis
TOOL_EXTRACTION_PROMPT = """
Analyze the following code from an MCP (Model Context Protocol) server and extract all tool definitions.

For each tool, extract:
1. name: The tool's name/identifier
2. description: What the tool does
3. category: One of: market_data, portfolio, trading, defi, nft, security, bridge, wallet, analytics, social, governance, staking, lending, yield, dex, cex, oracle, utility
4. input_schema: The JSON schema for the tool's input parameters
5. chains: List of blockchain networks supported (e.g., ethereum, solana, bsc, polygon, arbitrum)
6. requires_api_key: Whether the tool needs an API key
7. api_key_env_var: Environment variable name for the API key (if applicable)

Respond with valid JSON in this format:
{
  "tools": [
    {
      "name": "tool_name",
      "description": "What it does",
      "category": "category_name",
      "input_schema": {"type": "object", "properties": {...}},
      "chains": ["ethereum", "bsc"],
      "requires_api_key": false,
      "api_key_env_var": null
    }
  ],
  "warnings": ["Any warnings about the code"],
  "quality_notes": "Overall quality assessment"
}

CODE TO ANALYZE:
```
{code}
```
"""

SECURITY_ANALYSIS_PROMPT = """
Analyze this MCP server code for security issues.

Check for:
1. Command injection vulnerabilities
2. Unsafe deserialization
3. Hardcoded credentials/secrets
4. SQL injection risks
5. Unsafe file operations
6. Insecure randomness
7. Missing input validation
8. Unsafe eval/exec usage

Respond with JSON:
{
  "security_score": 0-100,
  "issues": [
    {"severity": "high|medium|low", "description": "...", "line": 123}
  ],
  "recommendations": ["..."]
}

CODE:
```
{code}
```
"""


class ToolAnalyzer:
    """
    AI-powered analyzer for MCP repositories.
    
    Analyzes repository code to extract tool definitions,
    assess quality, and check for security issues.
    """
    
    def __init__(self, config: Optional[ToolAnalysisConfig] = None):
        self.config = config or ToolAnalysisConfig()
        self._ai_client = None
        self._stats = {
            "repos_analyzed": 0,
            "tools_extracted": 0,
            "ai_calls": 0,
        }
    
    async def initialize(self) -> None:
        """Initialize the AI client."""
        await self._setup_ai_client()
    
    async def _setup_ai_client(self) -> None:
        """Set up the AI client based on provider."""
        if self.config.ai_provider == "openai":
            try:
                import openai
                self._ai_client = openai.AsyncOpenAI(api_key=self.config.api_key)
            except ImportError:
                logger.warning("OpenAI package not installed, using mock analyzer")
                self._ai_client = None
        elif self.config.ai_provider == "anthropic":
            try:
                import anthropic
                self._ai_client = anthropic.AsyncAnthropic(api_key=self.config.api_key)
            except ImportError:
                logger.warning("Anthropic package not installed, using mock analyzer")
                self._ai_client = None
    
    async def _call_ai(self, prompt: str) -> str:
        """Call the AI provider with a prompt."""
        self._stats["ai_calls"] += 1
        
        if self._ai_client is None:
            # Fallback to pattern-based extraction
            return self._mock_ai_response(prompt)
        
        try:
            if self.config.ai_provider == "openai":
                response = await self._ai_client.chat.completions.create(
                    model=self.config.ai_model,
                    messages=[
                        {"role": "system", "content": "You are an expert code analyzer specializing in MCP servers and crypto tools. Always respond with valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=4096,
                )
                return response.choices[0].message.content
                
            elif self.config.ai_provider == "anthropic":
                response = await self._ai_client.messages.create(
                    model=self.config.ai_model,
                    max_tokens=4096,
                    messages=[{"role": "user", "content": prompt}],
                )
                return response.content[0].text
                
        except Exception as e:
            logger.error(f"AI call failed: {e}")
            return self._mock_ai_response(prompt)
    
    def _mock_ai_response(self, prompt: str) -> str:
        """Fallback pattern-based extraction when AI is unavailable."""
        # Extract tool patterns from code using regex
        code_match = re.search(r'```\n(.*?)```', prompt, re.DOTALL)
        if not code_match:
            return '{"tools": [], "warnings": ["Could not parse code"], "quality_notes": "Analysis unavailable"}'
        
        code = code_match.group(1)
        tools = self._extract_tools_from_code(code)
        
        return json.dumps({
            "tools": tools,
            "warnings": ["Used pattern-based extraction (AI unavailable)"],
            "quality_notes": "Pattern-based analysis only"
        })
    
    def _extract_tools_from_code(self, code: str) -> List[Dict[str, Any]]:
        """Extract tool definitions using pattern matching."""
        tools = []
        
        # Pattern for TypeScript tool definitions
        ts_patterns = [
            r'name:\s*["\']([^"\']+)["\'].*?description:\s*["\']([^"\']+)["\']',
            r'{\s*name:\s*["\']([^"\']+)["\'],\s*description:\s*["\']([^"\']+)["\']',
        ]
        
        # Pattern for Python tool definitions
        py_patterns = [
            r'@tool\s*\(\s*["\']([^"\']+)["\'].*?"""([^"]+)"""',
            r'name\s*=\s*["\']([^"\']+)["\'].*?description\s*=\s*["\']([^"\']+)["\']',
        ]
        
        for pattern in ts_patterns + py_patterns:
            matches = re.findall(pattern, code, re.DOTALL | re.IGNORECASE)
            for match in matches:
                name, description = match[0], match[1].strip()[:200]
                
                # Infer category from name
                category = self._infer_category(name, description)
                
                # Infer chains from code context
                chains = self._infer_chains(code)
                
                tools.append({
                    "name": name,
                    "description": description,
                    "category": category,
                    "input_schema": {"type": "object", "properties": {}},
                    "chains": chains,
                    "requires_api_key": self._check_requires_api_key(code, name),
                    "api_key_env_var": None,
                })
        
        return tools
    
    def _infer_category(self, name: str, description: str) -> str:
        """Infer tool category from name and description."""
        text = (name + " " + description).lower()
        
        category_keywords = {
            "market_data": ["price", "market", "ohlc", "candle", "ticker", "quote"],
            "portfolio": ["portfolio", "balance", "holdings", "assets"],
            "trading": ["trade", "swap", "exchange", "order", "buy", "sell"],
            "defi": ["defi", "protocol", "tvl", "apy", "yield"],
            "nft": ["nft", "collectible", "token_id", "collection"],
            "security": ["security", "audit", "scan", "vulnerability", "goplus"],
            "bridge": ["bridge", "cross-chain", "transfer"],
            "wallet": ["wallet", "address", "account"],
            "analytics": ["analytics", "analysis", "metrics", "stats"],
            "staking": ["stake", "staking", "validator", "delegation"],
            "lending": ["lend", "borrow", "collateral", "liquidation"],
            "yield": ["yield", "farming", "apy", "apr"],
            "dex": ["dex", "uniswap", "pancakeswap", "sushi", "amm"],
            "cex": ["binance", "coinbase", "kraken", "exchange"],
            "oracle": ["oracle", "price_feed", "chainlink"],
        }
        
        for category, keywords in category_keywords.items():
            if any(kw in text for kw in keywords):
                return category
        
        return "utility"
    
    def _infer_chains(self, code: str) -> List[str]:
        """Infer supported blockchain networks from code."""
        code_lower = code.lower()
        chains = []
        
        chain_patterns = {
            "ethereum": ["ethereum", "eth", "mainnet", "goerli", "sepolia"],
            "bsc": ["bsc", "binance smart chain", "bnb chain"],
            "polygon": ["polygon", "matic"],
            "arbitrum": ["arbitrum", "arb"],
            "optimism": ["optimism", "op"],
            "solana": ["solana", "sol"],
            "avalanche": ["avalanche", "avax"],
            "fantom": ["fantom", "ftm"],
            "base": ["base chain", "base network"],
        }
        
        for chain, patterns in chain_patterns.items():
            if any(p in code_lower for p in patterns):
                chains.append(chain)
        
        return chains if chains else ["ethereum"]  # Default to ethereum
    
    def _check_requires_api_key(self, code: str, tool_name: str) -> bool:
        """Check if a tool likely requires an API key."""
        api_patterns = [
            r'api[_-]?key',
            r'API[_-]?KEY',
            r'apiKey',
            r'bearer\s+token',
            r'authorization',
            r'secret',
            r'credential',
        ]
        
        return any(re.search(p, code, re.IGNORECASE) for p in api_patterns)
    
    async def analyze_code(self, code: str, file_path: str = "unknown") -> List[ExtractedTool]:
        """
        Analyze code and extract tool definitions.
        
        Args:
            code: Source code to analyze
            file_path: Path to the source file
            
        Returns:
            List of extracted tools
        """
        if len(code) > self.config.max_file_size:
            logger.warning(f"File too large, truncating: {len(code)} bytes")
            code = code[:self.config.max_file_size]
        
        prompt = TOOL_EXTRACTION_PROMPT.format(code=code)
        
        try:
            response = await self._call_ai(prompt)
            
            # Parse JSON response
            # Handle markdown code blocks if present
            json_match = re.search(r'```(?:json)?\s*(.*?)```', response, re.DOTALL)
            if json_match:
                response = json_match.group(1)
            
            data = json.loads(response)
            
            tools = []
            for tool_data in data.get("tools", []):
                try:
                    category = ToolCategory(tool_data.get("category", "unknown"))
                except ValueError:
                    category = ToolCategory.UNKNOWN
                
                tool = ExtractedTool(
                    name=tool_data["name"],
                    description=tool_data.get("description", ""),
                    category=category,
                    input_schema=tool_data.get("input_schema", {}),
                    file_path=file_path,
                    chains=tool_data.get("chains", []),
                    requires_api_key=tool_data.get("requires_api_key", False),
                    api_key_env_var=tool_data.get("api_key_env_var"),
                )
                tools.append(tool)
            
            self._stats["tools_extracted"] += len(tools)
            return tools
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return []
    
    async def analyze_security(self, code: str) -> Dict[str, Any]:
        """
        Analyze code for security issues.
        
        Args:
            code: Source code to analyze
            
        Returns:
            Security analysis results
        """
        issues = []
        
        # Pattern-based security checks
        for pattern in self.config.security_patterns:
            matches = list(re.finditer(pattern, code))
            for match in matches:
                line_num = code[:match.start()].count('\n') + 1
                issues.append({
                    "severity": "medium",
                    "description": f"Potentially unsafe pattern: {pattern}",
                    "line": line_num,
                })
        
        # Check for hardcoded secrets
        secret_patterns = [
            (r'["\'][A-Za-z0-9]{32,}["\']', "Possible hardcoded API key"),
            (r'password\s*=\s*["\'][^"\']+["\']', "Hardcoded password"),
            (r'private[_-]?key\s*=\s*["\']', "Hardcoded private key"),
        ]
        
        for pattern, description in secret_patterns:
            matches = list(re.finditer(pattern, code, re.IGNORECASE))
            for match in matches:
                line_num = code[:match.start()].count('\n') + 1
                issues.append({
                    "severity": "high",
                    "description": description,
                    "line": line_num,
                })
        
        # Calculate score (start at 100, deduct for issues)
        score = 100
        for issue in issues:
            if issue["severity"] == "high":
                score -= 15
            elif issue["severity"] == "medium":
                score -= 5
            else:
                score -= 2
        
        score = max(0, score)
        
        return {
            "security_score": score,
            "issues": issues,
            "recommendations": self._generate_security_recommendations(issues),
        }
    
    def _generate_security_recommendations(self, issues: List[Dict[str, Any]]) -> List[str]:
        """Generate security recommendations based on issues found."""
        recommendations = []
        
        issue_types = set(i["description"] for i in issues)
        
        if any("API key" in t for t in issue_types):
            recommendations.append("Move API keys to environment variables")
        if any("password" in t.lower() for t in issue_types):
            recommendations.append("Never hardcode passwords - use secure credential management")
        if any("private key" in t.lower() for t in issue_types):
            recommendations.append("Store private keys in secure vaults, never in code")
        if any("eval" in t.lower() or "exec" in t.lower() for t in issue_types):
            recommendations.append("Avoid eval/exec - use safer alternatives")
        
        return recommendations
    
    async def analyze_repository(
        self,
        repo_path: str,
        repo_url: str,
        repo_full_name: str
    ) -> AnalyzedTool:
        """
        Analyze an entire repository.
        
        Args:
            repo_path: Local path to cloned repository
            repo_url: GitHub URL of the repository
            repo_full_name: Full name (owner/repo)
            
        Returns:
            Complete analysis results
        """
        import os
        from pathlib import Path
        
        all_tools: List[ExtractedTool] = []
        all_security_issues: List[Dict[str, Any]] = []
        total_security_score = 0
        files_analyzed = 0
        
        # Find relevant files
        relevant_extensions = {".ts", ".tsx", ".js", ".jsx", ".py"}
        mcp_keywords = ["mcp", "tool", "server", "handler"]
        
        repo_path_obj = Path(repo_path)
        
        for root, dirs, files in os.walk(repo_path):
            # Skip node_modules, .git, etc.
            dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "dist", "build", "__pycache__"}]
            
            for filename in files:
                ext = os.path.splitext(filename)[1]
                if ext not in relevant_extensions:
                    continue
                
                file_path = os.path.join(root, filename)
                relative_path = os.path.relpath(file_path, repo_path)
                
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        code = f.read()
                    
                    # Check if file is likely to contain tools
                    if not any(kw in code.lower() for kw in mcp_keywords):
                        continue
                    
                    # Analyze for tools
                    tools = await self.analyze_code(code, relative_path)
                    all_tools.extend(tools)
                    
                    # Security analysis
                    if self.config.check_security:
                        security = await self.analyze_security(code)
                        all_security_issues.extend(security["issues"])
                        total_security_score += security["security_score"]
                        files_analyzed += 1
                        
                except Exception as e:
                    logger.warning(f"Failed to analyze {file_path}: {e}")
                    continue
        
        # Calculate aggregate scores
        avg_security_score = total_security_score / max(files_analyzed, 1)
        
        # Documentation score based on README presence and quality
        doc_score = 50  # Base score
        readme_path = repo_path_obj / "README.md"
        if readme_path.exists():
            readme_content = readme_path.read_text(errors="ignore")
            doc_score = min(100, 50 + len(readme_content) // 100)
        
        # Quality score
        quality_score = (
            (avg_security_score * 0.4) +
            (doc_score * 0.3) +
            (min(100, len(all_tools) * 10) * 0.3)
        )
        
        # Collect unique categories and chains
        categories = list(set(t.category.value for t in all_tools))
        chains = list(set(chain for t in all_tools for chain in t.chains))
        requires_api_keys = any(t.requires_api_key for t in all_tools)
        
        self._stats["repos_analyzed"] += 1
        
        return AnalyzedTool(
            repo_full_name=repo_full_name,
            repo_url=repo_url,
            tools=all_tools,
            total_tools=len(all_tools),
            categories_found=categories,
            chains_supported=chains,
            requires_api_keys=requires_api_keys,
            quality_score=quality_score,
            documentation_score=doc_score,
            security_score=avg_security_score,
            issues=[f"{i['severity']}: {i['description']}" for i in all_security_issues[:10]],
            warnings=[],
            ai_model_used=self.config.ai_model if self._ai_client else "pattern-based",
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get analysis statistics."""
        return {
            **self._stats,
            "config": {
                "ai_provider": self.config.ai_provider,
                "ai_model": self.config.ai_model,
                "check_security": self.config.check_security,
            }
        }
