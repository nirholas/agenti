/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every expert was once a beginner 📚
 */

/**
 * Chain selector component for choosing blockchain networks
 */

import { useState, useMemo } from 'react';
import { Check, Info, ExternalLink, Filter } from 'lucide-react';
import { 
  ChainConfig, 
  ChainSelectorProps, 
  ContractLanguage 
} from '@/types/contracts';
import { 
  CHAINS_LIST, 
  getChainConfig,
  SOLIDITY_CHAINS,
  RUST_CHAINS 
} from '@/utils/chainConfigs';

/**
 * ChainSelector - Grid-based blockchain network selector
 * 
 * Features:
 * - Grid of chain logos/icons
 * - Testnet/Mainnet toggle
 * - Chain details on hover
 * - Currently selected indicator
 * - Filter by language (Solidity/Rust)
 */
export default function ChainSelector({
  selectedChain,
  onChainSelect,
  showTestnetToggle = true,
  showLanguageFilter = true,
  className = '',
}: ChainSelectorProps) {
  const [showTestnet, setShowTestnet] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<ContractLanguage | 'all'>('all');
  const [hoveredChain, setHoveredChain] = useState<string | null>(null);

  // Filter chains based on language
  const filteredChains = useMemo(() => {
    if (languageFilter === 'all') return CHAINS_LIST;
    if (languageFilter === 'solidity') return SOLIDITY_CHAINS;
    if (languageFilter === 'rust') return RUST_CHAINS;
    return CHAINS_LIST;
  }, [languageFilter]);

  // Get selected chain config
  const selectedConfig = selectedChain ? getChainConfig(selectedChain) : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Select Blockchain
        </h3>
        
        <div className="flex items-center gap-3">
          {/* Language Filter */}
          {showLanguageFilter && (
            <div className="flex items-center gap-1 text-xs">
              <Filter className="w-3 h-3 text-gray-500" />
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value as ContractLanguage | 'all')}
                className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Languages</option>
                <option value="solidity">Solidity</option>
                <option value="rust">Rust</option>
              </select>
            </div>
          )}
          
          {/* Testnet Toggle */}
          {showTestnetToggle && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showTestnet}
                onChange={(e) => setShowTestnet(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-gray-600 dark:text-gray-400">Show Testnet Info</span>
            </label>
          )}
        </div>
      </div>

      {/* Chain Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
        {filteredChains.map((chain) => (
          <ChainCard
            key={chain.id}
            chain={chain}
            isSelected={selectedChain === chain.id}
            isHovered={hoveredChain === chain.id}
            showTestnet={showTestnet}
            onSelect={() => onChainSelect(chain.id)}
            onHover={() => setHoveredChain(chain.id)}
            onLeave={() => setHoveredChain(null)}
          />
        ))}
      </div>

      {/* Selected Chain Details */}
      {selectedConfig && (
        <ChainDetails chain={selectedConfig} showTestnet={showTestnet} />
      )}

      {/* Hovered Chain Tooltip */}
      {hoveredChain && !selectedChain && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Click to select {getChainConfig(hoveredChain)?.name}
        </div>
      )}
    </div>
  );
}

/**
 * Individual chain card in the grid
 */
interface ChainCardProps {
  chain: ChainConfig;
  isSelected: boolean;
  isHovered: boolean;
  showTestnet: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}

function ChainCard({
  chain,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onLeave,
}: ChainCardProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200
        ${isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
          : isHovered
          ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${!chain.isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      disabled={!chain.isActive}
      title={chain.name}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Chain icon */}
      <span className="text-2xl mb-1" role="img" aria-label={chain.name}>
        {chain.icon}
      </span>

      {/* Chain name */}
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full text-center">
        {chain.name}
      </span>

      {/* Language badge */}
      <span className={`
        text-[10px] px-1.5 py-0.5 rounded mt-1
        ${chain.language === 'solidity' 
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : chain.language === 'rust'
          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }
      `}>
        {chain.language}
      </span>
    </button>
  );
}

/**
 * Detailed information about the selected chain
 */
interface ChainDetailsProps {
  chain: ChainConfig;
  showTestnet: boolean;
}

function ChainDetails({ chain, showTestnet }: ChainDetailsProps) {
  return (
    <div 
      className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
      style={{ borderLeftColor: chain.color, borderLeftWidth: '4px' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{chain.icon}</span>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {chain.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {chain.description}
            </p>
          </div>
        </div>
        
        <a
          href={chain.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
        >
          Explorer <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Chain info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
        <InfoItem label="Chain ID" value={chain.chainId.toString()} />
        <InfoItem label="Currency" value={`${chain.nativeCurrency.symbol}`} />
        <InfoItem label="Block Time" value={`~${chain.blockTime}s`} />
        <InfoItem label="Compiler" value={chain.compilerVersion} />
      </div>

      {/* Testnet info */}
      {showTestnet && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Testnet: {chain.testnet.name}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoItem label="Testnet Chain ID" value={chain.testnet.chainId.toString()} />
            <a
              href={chain.testnet.faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
            >
              Get testnet tokens <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Small info item component
 */
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

/**
 * Compact chain selector for sidebar use
 */
export function CompactChainSelector({
  selectedChain,
  onChainSelect,
  className = '',
}: Omit<ChainSelectorProps, 'showTestnetToggle' | 'showLanguageFilter'>) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {CHAINS_LIST.map((chain) => (
        <button
          key={chain.id}
          onClick={() => onChainSelect(chain.id)}
          className={`
            p-2 rounded-lg border transition-all
            ${selectedChain === chain.id
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }
          `}
          title={chain.name}
        >
          <span className="text-lg">{chain.icon}</span>
        </button>
      ))}
    </div>
  );
}
