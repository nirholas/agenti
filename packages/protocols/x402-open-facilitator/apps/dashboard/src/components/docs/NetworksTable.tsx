const networks = [
  { name: 'Base', v1: 'base', v2: 'eip155:8453', chainId: 8453, type: 'EVM', testnet: false },
  { name: 'Polygon', v1: 'polygon', v2: 'eip155:137', chainId: 137, type: 'EVM', testnet: false },
  { name: 'Avalanche', v1: 'avalanche', v2: 'eip155:43114', chainId: 43114, type: 'EVM', testnet: false },
  { name: 'Sei', v1: 'sei', v2: 'eip155:1329', chainId: 1329, type: 'EVM', testnet: false },
  { name: 'IoTeX', v1: 'iotex', v2: 'eip155:4689', chainId: 4689, type: 'EVM', testnet: false },
  { name: 'Peaq', v1: 'peaq', v2: 'eip155:3338', chainId: 3338, type: 'EVM', testnet: false },
  { name: 'X Layer', v1: 'xlayer', v2: 'eip155:196', chainId: 196, type: 'EVM', testnet: false },
  { name: 'Base Sepolia', v1: 'base-sepolia', v2: 'eip155:84532', chainId: 84532, type: 'EVM', testnet: true },
  { name: 'Polygon Amoy', v1: 'polygon-amoy', v2: 'eip155:80002', chainId: 80002, type: 'EVM', testnet: true },
  { name: 'Avalanche Fuji', v1: 'avalanche-fuji', v2: 'eip155:43113', chainId: 43113, type: 'EVM', testnet: true },
  { name: 'Sei Testnet', v1: 'sei-testnet', v2: 'eip155:1328', chainId: 1328, type: 'EVM', testnet: true },
  { name: 'X Layer Testnet', v1: 'xlayer-testnet', v2: 'eip155:195', chainId: 195, type: 'EVM', testnet: true },
  { name: 'Solana', v1: 'solana', v2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', chainId: null, type: 'Solana', testnet: false },
  { name: 'Solana Devnet', v1: 'solana-devnet', v2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', chainId: null, type: 'Solana', testnet: true },
  { name: 'Stacks', v1: 'stacks', v2: 'stacks:1', chainId: null, type: 'Stacks', testnet: false },
  { name: 'Stacks Testnet', v1: 'stacks-testnet', v2: 'stacks:2147483648', chainId: null, type: 'Stacks', testnet: true },
];

export function NetworksTable() {
  const mainnets = networks.filter(n => !n.testnet);
  const testnets = networks.filter(n => n.testnet);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Mainnets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Network</th>
                <th className="text-left py-2 px-3">v1 ID</th>
                <th className="text-left py-2 px-3">v2 ID (CAIP-2)</th>
                <th className="text-left py-2 px-3">Chain ID</th>
                <th className="text-left py-2 px-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {mainnets.map(network => (
                <tr key={network.v1} className="border-b border-muted">
                  <td className="py-2 px-3 font-medium">{network.name}</td>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">{network.v1}</code></td>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">{network.v2}</code></td>
                  <td className="py-2 px-3">{network.chainId ?? '—'}</td>
                  <td className="py-2 px-3">{network.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Testnets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Network</th>
                <th className="text-left py-2 px-3">v1 ID</th>
                <th className="text-left py-2 px-3">v2 ID (CAIP-2)</th>
                <th className="text-left py-2 px-3">Chain ID</th>
                <th className="text-left py-2 px-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {testnets.map(network => (
                <tr key={network.v1} className="border-b border-muted">
                  <td className="py-2 px-3 font-medium">{network.name}</td>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">{network.v1}</code></td>
                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">{network.v2}</code></td>
                  <td className="py-2 px-3">{network.chainId ?? '—'}</td>
                  <td className="py-2 px-3">{network.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
