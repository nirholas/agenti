import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const address = '0x8004A818BFB912233c491871b3d84c89A494BD9e';

  // 1. Find the real event signature by brute-forcing common names
  const regEventHash = '0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a';
  const metaEventHash = '0x2c149ed548c6d2993cd73efe187df6eccabe4538091b33adbd25fafdb8a1468b';
  const counterHash = '0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7';

  // More comprehensive brute force for the registration event
  const prefixes = ['', 'Agent', 'Identity', 'Token'];
  const verbs = ['Registered', 'Created', 'Minted', 'Issued', 'Added', 'Set', 'Deployed'];
  const argCombos = [
    '(uint256,address,string)',
    '(uint256,address,string,string)',
    '(address,uint256,string)',
    '(uint256,string)',
    '(uint256,address,bytes)',
  ];

  console.log('Brute-forcing registration event signature...');
  for (const prefix of prefixes) {
    for (const verb of verbs) {
      for (const args of argCombos) {
        const sig = `${prefix}${verb}${args}`;
        if (ethers.id(sig) === regEventHash) {
          console.log(`  FOUND: ${sig}`);
        }
      }
    }
  }

  // Also try for metadata
  const metaPrefixes = ['', 'Agent', 'Identity', 'Token'];
  const metaVerbs = ['MetadataUpdated', 'MetadataSet', 'SetMetadata', 'UpdateMetadata', 'MetadataChanged', 'MetadataAdded'];
  const metaArgs = [
    '(uint256,bytes32,bytes)',
    '(uint256,bytes32,string)',
    '(uint256,string,bytes)',
    '(uint256,string,string)',
    '(address,uint256,bytes32,bytes)',
  ];

  console.log('\nBrute-forcing metadata event signature...');
  for (const prefix of metaPrefixes) {
    for (const verb of metaVerbs) {
      for (const args of metaArgs) {
        const sig = `${prefix}${verb}${args}`;
        if (ethers.id(sig) === metaEventHash) {
          console.log(`  FOUND: ${sig}`);
        }
      }
    }
  }

  // Also check counter
  const counterSigs = [
    'CounterUpdated(uint256)', 'SupplyUpdated(uint256)', 'NextId(uint256)',
    'Counter(uint256)', 'Increment(uint256)', 'NewId(uint256)',
    'AgentCount(uint256)', 'TotalRegistered(uint256)',
  ];
  console.log('\nBrute-forcing counter event signature...');
  for (const sig of counterSigs) {
    if (ethers.id(sig) === counterHash) {
      console.log(`  FOUND: ${sig}`);
    }
  }

  // 2. Meanwhile, use the guaranteed approach: Transfer events from 0x0 = mints
  console.log('\n=== Finding all agents via ERC-721 Transfer (mint) events ===');

  const erc721 = new ethers.Contract(address, [
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'function tokenURI(uint256 tokenId) view returns (string)',
  ], provider);

  const currentBlock = await provider.getBlockNumber();
  const startBlock = 15000000;
  let allMints: { tokenId: number; owner: string; block: number }[] = [];

  for (let from = startBlock; from <= currentBlock; from += 10000) {
    const to = Math.min(from + 9999, currentBlock);
    try {
      const events = await erc721.queryFilter(erc721.filters.Transfer(ethers.ZeroAddress), from, to);
      for (const e of events) {
        const log = e as ethers.EventLog;
        allMints.push({
          tokenId: Number(log.args?.[2]),
          owner: log.args?.[1],
          block: log.blockNumber,
        });
      }
    } catch {
      // Chunk smaller on failure
      for (let f2 = from; f2 <= to; f2 += 2000) {
        const t2 = Math.min(f2 + 1999, to);
        try {
          const events = await erc721.queryFilter(erc721.filters.Transfer(ethers.ZeroAddress), f2, t2);
          for (const e of events) {
            const log = e as ethers.EventLog;
            allMints.push({
              tokenId: Number(log.args?.[2]),
              owner: log.args?.[1],
              block: log.blockNumber,
            });
          }
        } catch { /* skip */ }
      }
    }
  }

  console.log(`\nTotal agents registered: ${allMints.length}`);
  console.log('\nAll agents:');

  for (const mint of allMints) {
    let uri = '';
    try {
      uri = await erc721.tokenURI(mint.tokenId);
    } catch { uri = '(no URI)'; }
    console.log(`  ID: ${mint.tokenId}  Owner: ${mint.owner}  Block: ${mint.block}  URI: ${uri}`);
  }
}

main().catch(console.error);
