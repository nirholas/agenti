import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const address = '0x8004A818BFB912233c491871b3d84c89A494BD9e';

  // ERC-721 interface (8004 identity registry is an ERC-721)
  const erc721ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'function totalSupply() view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function balanceOf(address owner) view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
  ];

  const contract = new ethers.Contract(address, erc721ABI, provider);

  // Basic info
  try { console.log('Name:', await contract.name()); } catch(e: any) { console.log('name() failed:', e.message?.slice(0,200)); }
  try { console.log('Symbol:', await contract.symbol()); } catch(e: any) { console.log('symbol() failed:', e.message?.slice(0,200)); }
  try { console.log('Total supply:', (await contract.totalSupply()).toString()); } catch(e: any) { console.log('totalSupply() failed:', e.message?.slice(0,200)); }

  // Our agent
  try { console.log('Owner of 692:', await contract.ownerOf(692)); } catch(e: any) { console.log('ownerOf(692) failed:', e.message?.slice(0,200)); }
  try { console.log('TokenURI 692:', await contract.tokenURI(692)); } catch(e: any) { console.log('tokenURI(692) failed:', e.message?.slice(0,200)); }

  // Look for Transfer events (ERC-721 mints from 0x0)
  // This is the standard way ERC-721 minting shows up
  const currentBlock = await provider.getBlockNumber();
  console.log('\nCurrent block:', currentBlock);

  // Check our registration block
  const regBlock = 37725524;
  console.log(`\nChecking Transfer events around registration block ${regBlock}...`);

  const transferFilter = contract.filters.Transfer();
  try {
    const events = await contract.queryFilter(transferFilter, regBlock - 5, regBlock + 5);
    console.log(`Found ${events.length} Transfer events near reg block`);
    for (const e of events) {
      const log = e as ethers.EventLog;
      console.log(`  Block ${log.blockNumber}: from=${log.args?.[0]} to=${log.args?.[1]} tokenId=${log.args?.[2]?.toString()}`);
    }
  } catch(e: any) {
    console.log('Transfer query failed:', e.message?.slice(0, 200));
  }

  // Also check for our custom Registered event
  const customABI = [
    'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
  ];
  const customContract = new ethers.Contract(address, customABI, provider);
  try {
    const events = await customContract.queryFilter(customContract.filters.Registered(), regBlock - 5, regBlock + 5);
    console.log(`\nFound ${events.length} Registered events near reg block`);
    for (const e of events) {
      const log = e as ethers.EventLog;
      console.log(`  Block ${log.blockNumber}: agentId=${log.args?.[0]?.toString()} owner=${log.args?.[1]} uri=${log.args?.[2]}`);
    }
  } catch(e: any) {
    console.log('Registered query failed:', e.message?.slice(0, 200));
  }

  // Try scanning a wider recent range for ANY Transfer events to see if there's activity
  console.log(`\nScanning last 50,000 blocks for Transfer events...`);
  const scanFrom = currentBlock - 50000;
  try {
    const events = await contract.queryFilter(transferFilter, scanFrom, currentBlock);
    console.log(`Found ${events.length} Transfer events in last 50k blocks`);
    if (events.length > 0) {
      // Show last 10
      const last10 = events.slice(-10);
      for (const e of last10) {
        const log = e as ethers.EventLog;
        console.log(`  Block ${log.blockNumber}: from=${log.args?.[0]} to=${log.args?.[1]} tokenId=${log.args?.[2]?.toString()}`);
      }
    }
  } catch(e: any) {
    console.log('Wide scan failed:', e.message?.slice(0, 200));
  }

  // Check raw logs for the contract to see what events actually exist
  console.log(`\nChecking raw logs at registration block...`);
  try {
    const logs = await provider.getLogs({
      address,
      fromBlock: regBlock,
      toBlock: regBlock,
    });
    console.log(`Found ${logs.length} raw logs at block ${regBlock}`);
    for (const log of logs) {
      console.log(`  Topics: ${log.topics.join(', ')}`);
      console.log(`  Data: ${log.data.slice(0, 200)}`);
    }
  } catch(e: any) {
    console.log('Raw logs failed:', e.message?.slice(0, 200));
  }
}

main().catch(console.error);
