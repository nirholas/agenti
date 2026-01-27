export interface TemplateContract {
  name: string;
  address: string;
  network: string;
  description: string;
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  longDescription: string;
  contracts: TemplateContract[];
  samplePrompts: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

export const TEMPLATES: Template[] = [
  // 💎 USDs Stablecoin Core
  {
    id: "usds-stablecoin",
    name: "USDs Stablecoin Core",
    icon: "💎",
    category: "Sperax Protocol",
    description: "USDs auto-yield stablecoin - mint, redeem & earn",
    longDescription: "Master the USDs stablecoin - the auto-yield bearing stablecoin on Arbitrum. Claude helps you mint USDs from collateral, redeem back to stables, track rebase yields, and understand the protocol mechanics. Your balance grows automatically just by holding!",
    difficulty: "beginner",
    contracts: [
      {
        name: "USDs Token",
        address: "0xD74f5255D557944cf7Dd0E45FF521520002D5748",
        network: "arbitrum",
        description: "Auto-rebasing stablecoin"
      },
      {
        name: "Vault",
        address: "0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca",
        network: "arbitrum",
        description: "Mint & redeem USDs"
      },
      {
        name: "Collateral Manager",
        address: "0xdA6B48BA29fE5F0f32eB52FBA21D26DACA04E5e7",
        network: "arbitrum",
        description: "Collateral configuration"
      },
      {
        name: "Master Price Oracle",
        address: "0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50",
        network: "arbitrum",
        description: "Aggregated price feeds"
      }
    ],
    samplePrompts: [
      "What's the current USDs total supply and rebase APY?",
      "How do I mint USDs from USDC?",
      "Show me the supported collateral types and their caps",
      "Calculate how much yield I'd earn holding 10,000 USDs for a month"
    ]
  },

  // 🔒 veSPA Governance Staking
  {
    id: "vespa-staking",
    name: "veSPA Governance Staking",
    icon: "🔒",
    category: "Sperax Protocol",
    description: "Lock SPA for veSPA - vote, boost & earn",
    longDescription: "Unlock the full power of Sperax governance. Lock your SPA tokens for veSPA (vote-escrowed SPA) to earn boosted rewards, participate in governance votes, and direct protocol emissions. Longer locks = more power.",
    difficulty: "intermediate",
    contracts: [
      {
        name: "SPA Token",
        address: "0x5575552988A3A80504bBaeB1311674fCFd40aD4B",
        network: "arbitrum",
        description: "Sperax governance token"
      },
      {
        name: "veSPA",
        address: "0x2e2071180682Ce6C247B1eF93d382D509F5F6A17",
        network: "arbitrum",
        description: "Vote-escrowed SPA locker"
      },
      {
        name: "xSPA",
        address: "0x0966E72256d6055145902F72F9D3B6a194B9cCc3",
        network: "arbitrum",
        description: "Reward distribution token"
      },
      {
        name: "SPA Buyback",
        address: "0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3",
        network: "arbitrum",
        description: "Protocol revenue → SPA"
      }
    ],
    samplePrompts: [
      "What's the current veSPA APR and total locked SPA?",
      "How much veSPA would I get for locking 10,000 SPA for 4 years?",
      "Show me the top veSPA holders and their voting power",
      "When does my veSPA lock expire and how do I extend it?"
    ]
  },

  // 🌾 Demeter Yield Farms
  {
    id: "demeter-farms",
    name: "Demeter Yield Farms",
    icon: "🌾",
    category: "Sperax Protocol",
    description: "Concentrated liquidity farming on Uniswap V3 & Camelot",
    longDescription: "Supercharge your LP yields with Demeter Protocol. Provide concentrated liquidity on Uniswap V3 or Camelot V3, then stake your positions to earn additional SPA rewards. Claude helps you find the best farms and optimize your positions.",
    difficulty: "intermediate",
    contracts: [
      {
        name: "Farm Registry",
        address: "0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0",
        network: "arbitrum",
        description: "All active Demeter farms"
      },
      {
        name: "Rewarder Factory",
        address: "0x926477bAF60C25857419CC9Bf52E914881E1bDD3",
        network: "arbitrum",
        description: "Creates reward distributors"
      },
      {
        name: "UniV3 Farm Deployer",
        address: "0x0d9EFD8f11c0a09DB8C2CCBfF4cC6c26Ad98b956",
        network: "arbitrum",
        description: "Uniswap V3 farm creator"
      },
      {
        name: "CamelotV3 Deployer",
        address: "0xc6EcFBAE9e30E2B8D58AE0BBa29e0D0B3e8a8F8b",
        network: "arbitrum",
        description: "Camelot V3 farm creator"
      }
    ],
    samplePrompts: [
      "What are the highest APR Demeter farms right now?",
      "Show me all USDs-paired farms and their rewards",
      "How do I stake my Uniswap V3 LP position in Demeter?",
      "Calculate my potential rewards for the SPA-ETH farm"
    ]
  },

  // 💰 USDs Yield Engine
  {
    id: "usds-yield-engine",
    name: "USDs Yield Engine",
    icon: "💰",
    category: "Sperax Protocol",
    description: "How USDs generates yield - strategies & distribution",
    longDescription: "Peek behind the curtain of USDs's auto-yield mechanism. Explore how collateral is deployed to Aave, Compound, Stargate and other strategies to generate yield. Understand the dripper, rebase manager, and yield reserve.",
    difficulty: "advanced",
    contracts: [
      {
        name: "Yield Reserve",
        address: "0x0CB89A7A6a9E0d9E06EE0c52De040db0e2B079E6",
        network: "arbitrum",
        description: "Collects protocol yield"
      },
      {
        name: "Dripper",
        address: "0xEaA79893D17d4c1b3e76c684e7A89B3D46a6fb03",
        network: "arbitrum",
        description: "Drips yield for rebases"
      },
      {
        name: "Rebase Manager",
        address: "0xC21b3b55Db3cb0B6CA6F96c18E9534c96E1d4cfc",
        network: "arbitrum",
        description: "Orchestrates rebases"
      },
      {
        name: "Aave Strategy",
        address: "0x5E8422345238F34275888049021821E8E08CAa1f",
        network: "arbitrum",
        description: "Aave V3 yield strategy"
      },
      {
        name: "Compound Strategy",
        address: "0x8c9532a60E0E7C6BbD2B2c1303F63aCE1c3e9811",
        network: "arbitrum",
        description: "Compound V3 yield strategy"
      }
    ],
    samplePrompts: [
      "How much yield is currently in the dripper ready for distribution?",
      "Show me the allocation across yield strategies",
      "When was the last rebase and how much was distributed?",
      "What's the projected APY based on current strategy yields?"
    ]
  },

  // 🏦 Sperax Full Suite
  {
    id: "sperax-full-suite",
    name: "Sperax DeFi Suite",
    icon: "🏦",
    category: "Sperax Protocol",
    description: "Complete Sperax toolkit - USDs, SPA, veSPA & Demeter",
    longDescription: "The complete Sperax Protocol experience. Access all core contracts including USDs stablecoin, SPA governance, veSPA staking, Demeter farms, and yield strategies. Perfect for power users who want full protocol access.",
    difficulty: "advanced",
    contracts: [
      {
        name: "USDs Token",
        address: "0xD74f5255D557944cf7Dd0E45FF521520002D5748",
        network: "arbitrum",
        description: "Auto-yield stablecoin"
      },
      {
        name: "SPA Token",
        address: "0x5575552988A3A80504bBaeB1311674fCFd40aD4B",
        network: "arbitrum",
        description: "Governance token"
      },
      {
        name: "Vault",
        address: "0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca",
        network: "arbitrum",
        description: "Mint/redeem USDs"
      },
      {
        name: "veSPA",
        address: "0x2e2071180682Ce6C247B1eF93d382D509F5F6A17",
        network: "arbitrum",
        description: "Governance staking"
      },
      {
        name: "Farm Registry",
        address: "0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0",
        network: "arbitrum",
        description: "Demeter farms"
      },
      {
        name: "SPA Buyback",
        address: "0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3",
        network: "arbitrum",
        description: "Protocol buyback"
      }
    ],
    samplePrompts: [
      "Give me a full overview of Sperax Protocol metrics",
      "What's the total TVL across USDs and Demeter farms?",
      "Show me my complete Sperax portfolio - USDs, SPA, veSPA positions",
      "What's the most profitable strategy: holding USDs vs farming vs veSPA?"
    ]
  },

  // 🔵 Arbitrum DeFi Context
  {
    id: "arbitrum-defi-context",
    name: "Arbitrum DeFi Context",
    icon: "🔵",
    category: "Chain Specific",
    description: "Key Arbitrum protocols that integrate with Sperax",
    longDescription: "Explore the broader Arbitrum DeFi ecosystem that Sperax integrates with. From Camelot DEX for trading to Aave for lending, understand how USDs and SPA fit into Arbitrum's DeFi landscape.",
    difficulty: "intermediate",
    contracts: [
      {
        name: "Camelot Router",
        address: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
        network: "arbitrum",
        description: "Trade SPA/USDs pairs"
      },
      {
        name: "Aave V3 Pool",
        address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        network: "arbitrum",
        description: "Lending market"
      },
      {
        name: "Uniswap V3 Router",
        address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        network: "arbitrum",
        description: "DEX trading"
      },
      {
        name: "USDC (Native)",
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        network: "arbitrum",
        description: "Circle native USDC"
      },
      {
        name: "USDT",
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        network: "arbitrum",
        description: "Tether stablecoin"
      }
    ],
    samplePrompts: [
      "Where can I trade SPA with the best liquidity?",
      "Show me USDs pools across Arbitrum DEXes",
      "What's the SPA/ETH price on Camelot vs Uniswap?",
      "How do I bridge USDC to Arbitrum to mint USDs?"
    ]
  }
];

export function getTemplatesByCategory(templates: Template[]): Record<string, Template[]> {
  return templates.reduce((acc, template) => {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);
}
