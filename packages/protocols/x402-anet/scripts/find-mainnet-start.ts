import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const address = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

  // Check contract code exists
  const code = await provider.getCode(address);
  console.log('Contract code length:', code.length);

  const currentBlock = await provider.getBlockNumber();
  console.log('Current block:', currentBlock);

  // Binary search for first block where contract exists
  // Base mainnet started around block 1, currently ~42M
  // ERC-8004 launched ~late Jan 2026
  // Try some recent blocks to narrow down
  const testBlocks = [30_000_000, 35_000_000, 38_000_000, 40_000_000, 41_000_000, 42_000_000];

  for (const block of testBlocks) {
    if (block > currentBlock) continue;
    try {
      const codeAt = await provider.getCode(address, block);
      console.log(`Block ${block}: code=${codeAt.length > 2 ? 'YES' : 'NO'}`);
    } catch(e: any) {
      console.log(`Block ${block}: error (${e.message?.slice(0,50)})`);
    }
  }

  // Also check by looking for any Transfer events in the last 5M blocks
  const erc721 = new ethers.Contract(address, [
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  ], provider);

  console.log('\nScanning for first Transfer events...');

  // Start from 38M in 500k chunks, looking for first activity
  for (let from = 38_000_000; from < currentBlock; from += 500_000) {
    const to = Math.min(from + 499_999, currentBlock);
    try {
      const events = await erc721.queryFilter(erc721.filters.Transfer(), from, to);
      if (events.length > 0) {
        console.log(`First activity in range ${from}-${to}: ${events.length} Transfer events`);
        console.log(`First event at block: ${events[0].blockNumber}`);
        break;
      } else {
        console.log(`${from}-${to}: no events`);
      }
    } catch(e: any) {
      // Try smaller chunks
      for (let f2 = from; f2 <= to; f2 += 10_000) {
        const t2 = Math.min(f2 + 9_999, to);
        try {
          const events = await erc721.queryFilter(erc721.filters.Transfer(), f2, t2);
          if (events.length > 0) {
            console.log(`First activity at block: ${events[0].blockNumber}`);
            return;
          }
        } catch { continue; }
      }
      console.log(`${from}-${to}: query failed, continuing...`);
    }
  }
}

main().catch(console.error);
