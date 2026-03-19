import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const address = '0x8004A818BFB912233c491871b3d84c89A494BD9e';

  // Compute our Registered event hash to compare
  const ourHash = ethers.id('Registered(uint256,address,string)');
  console.log('Our Registered event hash:', ourHash);

  // The actual event hashes from the contract at block 37725524
  const actualHashes = {
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer(address,address,uint256) [ERC-721]',
    '0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7': '??? (no indexed params)',
    '0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a': '??? (2 indexed params: agentId, owner + URI in data)',
    '0x2c149ed548c6d2993cd73efe187df6eccabe4538091b33adbd25fafdb8a1468b': '??? (2 indexed params: agentId, key + value in data)',
  };

  console.log('\nActual event topic hashes from contract:');
  for (const [hash, desc] of Object.entries(actualHashes)) {
    console.log(`  ${hash.slice(0, 20)}... = ${desc}`);
  }

  // Try common ERC-8004 event signatures
  const candidates = [
    'Registered(uint256,address,string)',
    'AgentRegistered(uint256,address,string)',
    'Registered(uint256,address)',
    'Register(uint256,address,string)',
    'Created(uint256,address,string)',
    'Mint(uint256,address,string)',
    'AgentCreated(uint256,address,string)',
    'IdentityCreated(uint256,address,string)',
    'IdentityRegistered(uint256,address,string)',
    // Maybe the URI is not part of the event name
    'Registered(uint256,address,bytes)',
    'URISet(uint256,string)',
    'URIUpdated(uint256,string)',
    'AgentURISet(uint256,string)',
    'MetadataUpdate(uint256)',
    'MetadataUpdated(uint256,bytes32,bytes)',
    'SetMetadata(uint256,bytes32,bytes)',
  ];

  const regEventHash = '0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a';
  const metaEventHash = '0x2c149ed548c6d2993cd73efe187df6eccabe4538091b33adbd25fafdb8a1468b';
  const counterHash = '0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7';

  console.log('\nTrying to match registration event:');
  for (const sig of candidates) {
    const hash = ethers.id(sig);
    if (hash === regEventHash) {
      console.log(`  MATCH: ${sig} => ${hash}`);
    }
  }

  // Try more candidates for metadata event
  const metaCandidates = [
    'MetadataUpdated(uint256,bytes32,bytes)',
    'MetadataSet(uint256,bytes32,bytes)',
    'SetMetadata(uint256,bytes32,bytes)',
    'AgentMetadataUpdated(uint256,bytes32,bytes)',
    'MetadataUpdate(uint256,bytes32,bytes)',
    'UpdateMetadata(uint256,bytes32,bytes)',
    'SetAgentMetadata(uint256,bytes32,bytes)',
  ];

  console.log('\nTrying to match metadata event:');
  for (const sig of metaCandidates) {
    const hash = ethers.id(sig);
    if (hash === metaEventHash) {
      console.log(`  MATCH: ${sig} => ${hash}`);
    }
  }

  // Try counter event
  const counterCandidates = [
    'CountUpdated(uint256)',
    'Minted(uint256)',
    'TokenMinted(uint256)',
    'AgentMinted(uint256)',
    'NewAgent(uint256)',
    'Created(uint256)',
    'Registered(uint256)',
  ];

  console.log('\nTrying to match counter event:');
  for (const sig of counterCandidates) {
    const hash = ethers.id(sig);
    if (hash === counterHash) {
      console.log(`  MATCH: ${sig} => ${hash}`);
    }
  }

  // Decode the actual data from event 3 (registration) to understand the structure
  console.log('\n--- Decoding registration event data ---');
  const regLog = {
    topics: [
      '0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a',
      '0x00000000000000000000000000000000000000000000000000000000000002b4',
      '0x0000000000000000000000007eec5fab4c3937fa3331177aba1d987b50a457fe',
    ],
    data: '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000006668747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f6f70656e636c61772f6167656e74732f6d61696e2f3078374565633566616234433339333746613333333131373741426131643938376235306134353766452e6a736f6e00000000000000000000000000000000000000000000000000',
  };

  console.log('Agent ID (topic 1):', parseInt(regLog.topics[1], 16));
  console.log('Owner (topic 2):', '0x' + regLog.topics[2].slice(26));

  // Decode string from data
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], regLog.data);
  console.log('URI (data):', decoded[0]);

  // Now try to find the actual event name using 4byte directory
  // Let's also scan a wider range using Transfer (which we know works) to find all registrations
  console.log('\n--- Scanning for all registrations via Transfer (mint from 0x0) ---');

  const erc721 = new ethers.Contract(address, ['event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'], provider);
  const zeroFilter = erc721.filters.Transfer(ethers.ZeroAddress);

  // Scan from genesis in 10k chunks
  const startBlock = 15000000; // well before any 8004 activity
  const currentBlock = await provider.getBlockNumber();
  let allMints: any[] = [];

  console.log(`Scanning from block ${startBlock} to ${currentBlock} for mints...`);

  for (let from = startBlock; from <= currentBlock; from += 10000) {
    const to = Math.min(from + 9999, currentBlock);
    try {
      const events = await erc721.queryFilter(zeroFilter, from, to);
      if (events.length > 0) {
        allMints.push(...events);
        for (const e of events) {
          const log = e as ethers.EventLog;
          console.log(`  Block ${log.blockNumber}: tokenId=${log.args?.[2]?.toString()} to=${log.args?.[1]}`);
        }
      }
    } catch(e: any) {
      // RPC limit, try smaller chunks
      for (let f2 = from; f2 <= to; f2 += 2000) {
        const t2 = Math.min(f2 + 1999, to);
        try {
          const events = await erc721.queryFilter(zeroFilter, f2, t2);
          if (events.length > 0) {
            allMints.push(...events);
            for (const e of events) {
              const log = e as ethers.EventLog;
              console.log(`  Block ${log.blockNumber}: tokenId=${log.args?.[2]?.toString()} to=${log.args?.[1]}`);
            }
          }
        } catch { /* skip */ }
      }
    }
  }

  console.log(`\nTotal mints found: ${allMints.length}`);
}

main().catch(console.error);
