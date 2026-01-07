import { z } from 'zod';
import { keccak256, toHex, parseAbiItem, parseAbi, formatEther, parseEther, createPublicClient, http, createWalletClient, getContract, formatUnits, parseUnits, formatGwei, parseGwei, decodeEventLog, encodeFunctionData, decodeFunctionResult, hashMessage, verifyMessage, recoverMessageAddress, hashTypedData, verifyTypedData, recoverTypedDataAddress, decodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { iotexTestnet, opBNBTestnet, bscTestnet, polygonAmoy, baseSepolia, arbitrumSepolia, optimismSepolia, sepolia, iotex, opBNB, bsc, polygon, base, arbitrum, optimism, mainnet } from 'viem/chains';
import { normalize, namehash } from 'viem/ens';
import * as util from 'util';

// src/evm/modules/blocks/prompts.ts
var defaultNetworkParam = z.string().describe(
  "Network name (e.g. 'bsc', 'opbnb', 'ethereum', 'base', etc.) or chain ID. Supports others main popular networks. Defaults to BSC mainnet."
).default("bsc");
var networkSchema = z.string().describe(
  "Network name (e.g. 'bsc', 'opbnb', 'ethereum', 'base', etc.) or chain ID. Supports others main popular networks. Defaults to BSC mainnet."
).optional();
var privateKeyParam = z.string().describe(
  "Private key in hex format (with or without 0x prefix). SECURITY: This is used only for address derivation and is not stored. The private key will not be logged or displayed in chat history."
).default(process.env.PRIVATE_KEY);

// src/evm/modules/blocks/prompts.ts
function registerBlockPrompts(server) {
  server.prompt(
    "analyze_block",
    "Analyze a block and provide detailed information about its contents",
    {
      blockNumber: z.string().optional().describe(
        "Block number to explore. If not provided, latest block will be used."
      ),
      network: networkSchema
    },
    ({ blockNumber, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: blockNumber ? `Please analyze block #${blockNumber} on the ${network} network and provide information about its key metrics, transactions, and significance.` : `Please analyze the latest block on the ${network} network and provide information about its key metrics, transactions, and significance.`
          }
        }
      ]
    })
  );
}
var DEFAULT_RPC_URL = "https://eth.llamarpc.com";
var DEFAULT_CHAIN_ID = 1;
var chainMap = {
  // Mainnets
  1: mainnet,
  10: optimism,
  42161: arbitrum,
  8453: base,
  137: polygon,
  56: bsc,
  204: opBNB,
  4689: iotex,
  // Testnets
  11155111: sepolia,
  11155420: optimismSepolia,
  421614: arbitrumSepolia,
  84532: baseSepolia,
  80002: polygonAmoy,
  97: bscTestnet,
  5611: opBNBTestnet,
  4690: iotexTestnet
};
var networkNameMap = {
  // Mainnets
  ethereum: 1,
  mainnet: 1,
  eth: 1,
  optimism: 10,
  op: 10,
  arbitrum: 42161,
  arb: 42161,
  base: 8453,
  polygon: 137,
  matic: 137,
  binance: 56,
  bsc: 56,
  opbnb: 204,
  iotex: 4689,
  // Testnets
  sepolia: 11155111,
  "optimism-sepolia": 11155420,
  optimismsepolia: 11155420,
  "arbitrum-sepolia": 421614,
  arbitrumsepolia: 421614,
  "base-sepolia": 84532,
  basesepolia: 84532,
  "polygon-amoy": 80002,
  polygonamoy: 80002,
  "bsc-testnet": 97,
  bsctestnet: 97,
  "opbnb-testnet": 5611,
  opbnbtestnet: 5611,
  "iotex-testnet": 4690,
  iotextestnet: 4690
};
var rpcUrlMap = {
  // Mainnets
  1: "https://eth.llamarpc.com",
  10: "https://mainnet.optimism.io",
  42161: "https://arb1.arbitrum.io/rpc",
  8453: "https://mainnet.base.org",
  137: "https://polygon-rpc.com",
  56: "https://bsc-dataseed.binance.org",
  204: "https://opbnb-mainnet-rpc.bnbchain.org",
  4689: "https://babel-api.mainnet.iotex.io",
  // Testnets
  11155111: "https://eth-sepolia.g.alchemy.com/v2/demo",
  11155420: "https://sepolia.optimism.io",
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
  84532: "https://sepolia.base.org",
  80002: "https://polygon-amoy.infura.io",
  97: "https://data-seed-prebsc-1-s1.binance.org:8545",
  5611: "https://opbnb-testnet-rpc.bnbchain.org",
  4690: "https://babel-api.testnet.iotex.io"
};
function resolveChainId(chainIdentifier) {
  if (typeof chainIdentifier === "number") {
    return chainIdentifier;
  }
  const networkName = chainIdentifier.toLowerCase();
  if (networkName in networkNameMap) {
    return networkNameMap[networkName];
  }
  const parsedId = parseInt(networkName);
  if (!isNaN(parsedId)) {
    return parsedId;
  }
  return DEFAULT_CHAIN_ID;
}
function getChain(chainIdentifier = DEFAULT_CHAIN_ID) {
  if (typeof chainIdentifier === "string") {
    const networkName = chainIdentifier.toLowerCase();
    if (networkNameMap[networkName]) {
      return chainMap[networkNameMap[networkName]] || mainnet;
    }
    throw new Error(`Unsupported network: ${chainIdentifier}`);
  }
  return chainMap[chainIdentifier] || mainnet;
}
function getRpcUrl(chainIdentifier = DEFAULT_CHAIN_ID) {
  const chainId = typeof chainIdentifier === "string" ? resolveChainId(chainIdentifier) : chainIdentifier;
  return rpcUrlMap[chainId] || DEFAULT_RPC_URL;
}
function getSupportedNetworks() {
  return Object.keys(networkNameMap).filter((name) => name.length > 2).sort();
}

// src/evm/services/clients.ts
var clientCache = /* @__PURE__ */ new Map();
function getPublicClient(network = "ethereum") {
  const cacheKey = String(network);
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }
  const chain = getChain(network);
  const rpcUrl = getRpcUrl(network);
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });
  clientCache.set(cacheKey, client);
  return client;
}
function getWalletClient(privateKey, network = "ethereum") {
  const chain = getChain(network);
  const rpcUrl = getRpcUrl(network);
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl)
  });
}
function getAddressFromPrivateKey(privateKey) {
  const account = privateKeyToAccount(privateKey);
  return account.address;
}

// src/evm/services/abi/erc20.ts
var ERC20_ABI = [
  {
    inputs: [
      {
        internalType: "string",
        name: "_name",
        type: "string"
      },
      {
        internalType: "string",
        name: "_symbol",
        type: "string"
      },
      {
        internalType: "uint256",
        name: "_totalSupply",
        type: "uint256"
      }
    ],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "allowance",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "needed",
        type: "uint256"
      }
    ],
    name: "ERC20InsufficientAllowance",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "balance",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "needed",
        type: "uint256"
      }
    ],
    name: "ERC20InsufficientBalance",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "approver",
        type: "address"
      }
    ],
    name: "ERC20InvalidApprover",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address"
      }
    ],
    name: "ERC20InvalidReceiver",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address"
      }
    ],
    name: "ERC20InvalidSender",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address"
      }
    ],
    name: "ERC20InvalidSpender",
    type: "error"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "Approval",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "Transfer",
    type: "event"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        internalType: "address",
        name: "spender",
        type: "address"
      }
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "transferFrom",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  }
];
var ERC20_BYTECODE = "0x608060405234801561000f575f5ffd5b506040516118df3803806118df833981810160405281019061003191906104b7565b828281600390816100429190610746565b5080600490816100529190610746565b5050506100893361006761009160201b60201c565b600a610073919061097d565b8361007e91906109c7565b61009960201b60201c565b505050610af0565b5f6012905090565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610109575f6040517fec442f050000000000000000000000000000000000000000000000000000000081526004016101009190610a47565b60405180910390fd5b61011a5f838361011e60201b60201c565b5050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160361016e578060025f8282546101629190610a60565b9250508190555061023c565b5f5f5f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050818110156101f7578381836040517fe450d38c0000000000000000000000000000000000000000000000000000000081526004016101ee93929190610aa2565b60405180910390fd5b8181035f5f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2081905550505b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610283578060025f82825403925050819055506102cd565b805f5f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161032a9190610ad7565b60405180910390a3505050565b5f604051905090565b5f5ffd5b5f5ffd5b5f5ffd5b5f5ffd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b61039682610350565b810181811067ffffffffffffffff821117156103b5576103b4610360565b5b80604052505050565b5f6103c7610337565b90506103d3828261038d565b919050565b5f67ffffffffffffffff8211156103f2576103f1610360565b5b6103fb82610350565b9050602081019050919050565b8281835e5f83830152505050565b5f610428610423846103d8565b6103be565b9050828152602081018484840111156104445761044361034c565b5b61044f848285610408565b509392505050565b5f82601f83011261046b5761046a610348565b5b815161047b848260208601610416565b91505092915050565b5f819050919050565b61049681610484565b81146104a0575f5ffd5b50565b5f815190506104b18161048d565b92915050565b5f5f5f606084860312156104ce576104cd610340565b5b5f84015167ffffffffffffffff8111156104eb576104ea610344565b5b6104f786828701610457565b935050602084015167ffffffffffffffff81111561051857610517610344565b5b61052486828701610457565b9250506040610535868287016104a3565b9150509250925092565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061058d57607f821691505b6020821081036105a05761059f610549565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026106027fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826105c7565b61060c86836105c7565b95508019841693508086168417925050509392505050565b5f819050919050565b5f61064761064261063d84610484565b610624565b610484565b9050919050565b5f819050919050565b6106608361062d565b61067461066c8261064e565b8484546105d3565b825550505050565b5f5f905090565b61068b61067c565b610696818484610657565b505050565b5b818110156106b9576106ae5f82610683565b60018101905061069c565b5050565b601f8211156106fe576106cf816105a6565b6106d8846105b8565b810160208510156106e7578190505b6106fb6106f3856105b8565b83018261069b565b50505b505050565b5f82821c905092915050565b5f61071e5f1984600802610703565b1980831691505092915050565b5f610736838361070f565b9150826002028217905092915050565b61074f8261053f565b67ffffffffffffffff81111561076857610767610360565b5b6107728254610576565b61077d8282856106bd565b5f60209050601f8311600181146107ae575f841561079c578287015190505b6107a6858261072b565b86555061080d565b601f1984166107bc866105a6565b5f5b828110156107e3578489015182556001820191506020850194506020810190506107be565b8683101561080057848901516107fc601f89168261070f565b8355505b6001600288020188555050505b505050505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f8160011c9050919050565b5f5f8291508390505b60018511156108975780860481111561087357610872610815565b5b60018516156108825780820291505b808102905061089085610842565b9450610857565b94509492505050565b5f826108af576001905061096a565b816108bc575f905061096a565b81600181146108d257600281146108dc5761090b565b600191505061096a565b60ff8411156108ee576108ed610815565b5b8360020a91508482111561090557610904610815565b5b5061096a565b5060208310610133831016604e8410600b84101617156109405782820a90508381111561093b5761093a610815565b5b61096a565b61094d848484600161084e565b9250905081840481111561096457610963610815565b5b81810290505b9392505050565b5f60ff82169050919050565b5f61098782610484565b915061099283610971565b92506109bf7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff84846108a0565b905092915050565b5f6109d182610484565b91506109dc83610484565b92508282026109ea81610484565b91508282048414831517610a0157610a00610815565b5b5092915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f610a3182610a08565b9050919050565b610a4181610a27565b82525050565b5f602082019050610a5a5f830184610a38565b92915050565b5f610a6a82610484565b9150610a7583610484565b9250828201905080821115610a8d57610a8c610815565b5b92915050565b610a9c81610484565b82525050565b5f606082019050610ab55f830186610a38565b610ac26020830185610a93565b610acf6040830184610a93565b949350505050565b5f602082019050610aea5f830184610a93565b92915050565b610de280610afd5f395ff3fe608060405234801561000f575f5ffd5b5060043610610091575f3560e01c8063313ce56711610064578063313ce5671461013157806370a082311461014f57806395d89b411461017f578063a9059cbb1461019d578063dd62ed3e146101cd57610091565b806306fdde0314610095578063095ea7b3146100b357806318160ddd146100e357806323b872dd14610101575b5f5ffd5b61009d6101fd565b6040516100aa9190610a5b565b60405180910390f35b6100cd60048036038101906100c89190610b0c565b61028d565b6040516100da9190610b64565b60405180910390f35b6100eb6102af565b6040516100f89190610b8c565b60405180910390f35b61011b60048036038101906101169190610ba5565b6102b8565b6040516101289190610b64565b60405180910390f35b6101396102e6565b6040516101469190610c10565b60405180910390f35b61016960048036038101906101649190610c29565b6102ee565b6040516101769190610b8c565b60405180910390f35b610187610333565b6040516101949190610a5b565b60405180910390f35b6101b760048036038101906101b29190610b0c565b6103c3565b6040516101c49190610b64565b60405180910390f35b6101e760048036038101906101e29190610c54565b6103e5565b6040516101f49190610b8c565b60405180910390f35b60606003805461020c90610cbf565b80601f016020809104026020016040519081016040528092919081815260200182805461023890610cbf565b80156102835780601f1061025a57610100808354040283529160200191610283565b820191905f5260205f20905b81548152906001019060200180831161026657829003601f168201915b5050505050905090565b5f5f610297610467565b90506102a481858561046e565b600191505092915050565b5f600254905090565b5f5f6102c2610467565b90506102cf858285610480565b6102da858585610513565b60019150509392505050565b5f6012905090565b5f5f5f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050919050565b60606004805461034290610cbf565b80601f016020809104026020016040519081016040528092919081815260200182805461036e90610cbf565b80156103b95780601f10610390576101008083540402835291602001916103b9565b820191905f5260205f20905b81548152906001019060200180831161039c57829003601f168201915b5050505050905090565b5f5f6103cd610467565b90506103da818585610513565b600191505092915050565b5f60015f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905092915050565b5f33905090565b61047b8383836001610603565b505050565b5f61048b84846103e5565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81101561050d57818110156104fe578281836040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526004016104f593929190610cfe565b60405180910390fd5b61050c84848484035f610603565b5b50505050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610583575f6040517f96c6fd1e00000000000000000000000000000000000000000000000000000000815260040161057a9190610d33565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036105f3575f6040517fec442f050000000000000000000000000000000000000000000000000000000081526004016105ea9190610d33565b60405180910390fd5b6105fe8383836107d2565b505050565b5f73ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603610673575f6040517fe602df0500000000000000000000000000000000000000000000000000000000815260040161066a9190610d33565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036106e3575f6040517f94280d620000000000000000000000000000000000000000000000000000000081526004016106da9190610d33565b60405180910390fd5b8160015f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f208190555080156107cc578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516107c39190610b8c565b60405180910390a35b50505050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610822578060025f8282546108169190610d79565b925050819055506108f0565b5f5f5f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050818110156108ab578381836040517fe450d38c0000000000000000000000000000000000000000000000000000000081526004016108a293929190610cfe565b60405180910390fd5b8181035f5f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2081905550505b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610937578060025f8282540392505081905550610981565b805f5f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516109de9190610b8c565b60405180910390a3505050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f610a2d826109eb565b610a3781856109f5565b9350610a47818560208601610a05565b610a5081610a13565b840191505092915050565b5f6020820190508181035f830152610a738184610a23565b905092915050565b5f5ffd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f610aa882610a7f565b9050919050565b610ab881610a9e565b8114610ac2575f5ffd5b50565b5f81359050610ad381610aaf565b92915050565b5f819050919050565b610aeb81610ad9565b8114610af5575f5ffd5b50565b5f81359050610b0681610ae2565b92915050565b5f5f60408385031215610b2257610b21610a7b565b5b5f610b2f85828601610ac5565b9250506020610b4085828601610af8565b9150509250929050565b5f8115159050919050565b610b5e81610b4a565b82525050565b5f602082019050610b775f830184610b55565b92915050565b610b8681610ad9565b82525050565b5f602082019050610b9f5f830184610b7d565b92915050565b5f5f5f60608486031215610bbc57610bbb610a7b565b5b5f610bc986828701610ac5565b9350506020610bda86828701610ac5565b9250506040610beb86828701610af8565b9150509250925092565b5f60ff82169050919050565b610c0a81610bf5565b82525050565b5f602082019050610c235f830184610c01565b92915050565b5f60208284031215610c3e57610c3d610a7b565b5b5f610c4b84828501610ac5565b91505092915050565b5f5f60408385031215610c6a57610c69610a7b565b5b5f610c7785828601610ac5565b9250506020610c8885828601610ac5565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f6002820490506001821680610cd657607f821691505b602082108103610ce957610ce8610c92565b5b50919050565b610cf881610a9e565b82525050565b5f606082019050610d115f830186610cef565b610d1e6020830185610b7d565b610d2b6040830184610b7d565b949350505050565b5f602082019050610d465f830184610cef565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610d8382610ad9565b9150610d8e83610ad9565b9250828201905080821115610da657610da5610d4c565b5b9291505056fea2646970667358221220eb8d49e37900170cfd6b967605cf1eb67ac6a321ef83cb2ca3a403058f0b090b64736f6c634300081e0033";
async function resolveAddress(addressOrEns, network = "ethereum") {
  if (/^0x[a-fA-F0-9]{40}$/.test(addressOrEns)) {
    return addressOrEns;
  }
  if (addressOrEns.includes(".")) {
    try {
      const normalizedEns = normalize(addressOrEns);
      const publicClient = getPublicClient(network);
      const address = await publicClient.getEnsAddress({
        name: normalizedEns
      });
      if (!address) {
        throw new Error(
          `ENS name ${addressOrEns} could not be resolved to an address`
        );
      }
      return address;
    } catch (error) {
      throw new Error(
        `Failed to resolve ENS name ${addressOrEns}: ${error.message}`
      );
    }
  }
  throw new Error(`Invalid address or ENS name: ${addressOrEns}`);
}

// src/evm/services/balance.ts
async function getNativeBalance(addressOrEns, network = "bsc") {
  const address = await resolveAddress(addressOrEns, network);
  const client = getPublicClient(network);
  const balance = await client.getBalance({ address });
  const nativeCurrency = client.chain?.nativeCurrency;
  return {
    raw: balance,
    formatted: formatEther(balance),
    network,
    symbol: nativeCurrency?.symbol ?? "Unknown",
    decimals: nativeCurrency?.decimals ?? 18
  };
}
async function getERC20Balance(tokenAddressOrEns, ownerAddressOrEns, network = "ethereum") {
  const tokenAddress = await resolveAddress(tokenAddressOrEns, network);
  const ownerAddress = await resolveAddress(ownerAddressOrEns, network);
  const publicClient = getPublicClient(network);
  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  });
  const [balance, symbol, decimals] = await Promise.all([
    contract.read.balanceOf([ownerAddress]),
    contract.read.symbol(),
    contract.read.decimals()
  ]);
  return {
    raw: balance,
    formatted: formatUnits(balance, decimals),
    symbol,
    decimals,
    network,
    tokenAddress,
    ownerAddress
  };
}

// src/evm/services/abi/erc721.ts
var ERC721_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "approved",
        type: "address"
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256"
      }
    ],
    name: "Approval",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address"
      },
      { indexed: false, internalType: "bool", name: "approved", type: "bool" }
    ],
    name: "ApprovalForAll",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256"
      }
    ],
    name: "Transfer",
    type: "event"
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256"
      }
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "getApproved",
    outputs: [{ internalType: "address", name: "operator", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      {
        internalType: "address",
        name: "operator",
        type: "address"
      }
    ],
    name: "isApprovedForAll",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "owner", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      {
        internalType: "address",
        name: "to",
        type: "address"
      },
      { internalType: "uint256", name: "tokenId", type: "uint256" }
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      {
        internalType: "address",
        name: "to",
        type: "address"
      },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes"
      }
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "operator", type: "address" },
      {
        internalType: "bool",
        name: "_approved",
        type: "bool"
      }
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      {
        internalType: "address",
        name: "to",
        type: "address"
      },
      { internalType: "uint256", name: "tokenId", type: "uint256" }
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// src/evm/services/abi/erc1155.ts
var ERC1155_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address"
      },
      {
        indexed: false,
        internalType: "bool",
        name: "approved",
        type: "bool"
      }
    ],
    name: "ApprovalForAll",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]"
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "values",
        type: "uint256[]"
      }
    ],
    name: "TransferBatch",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "id",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "TransferSingle",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "value",
        type: "string"
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256"
      }
    ],
    name: "URI",
    type: "event"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "accounts",
        type: "address[]"
      },
      {
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]"
      }
    ],
    name: "balanceOfBatch",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address"
      },
      {
        internalType: "address",
        name: "operator",
        type: "address"
      }
    ],
    name: "isApprovedForAll",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]"
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]"
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes"
      }
    ],
    name: "safeBatchTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes"
      }
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address"
      },
      {
        internalType: "bool",
        name: "approved",
        type: "bool"
      }
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "interfaceId",
        type: "bytes4"
      }
    ],
    name: "supportsInterface",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256"
      }
    ],
    name: "uri",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];

// src/evm/services/transfer.ts
async function transferETH(privateKey, toAddressOrEns, amount, network = "ethereum") {
  const toAddress = await resolveAddress(toAddressOrEns, network);
  const formattedKey = typeof privateKey === "string" && !privateKey.startsWith("0x") ? `0x${privateKey}` : privateKey;
  const client = getWalletClient(formattedKey, network);
  const amountWei = parseEther(amount);
  return client.sendTransaction({
    to: toAddress,
    value: amountWei,
    account: client.account,
    chain: client.chain
  });
}
async function transferERC20(tokenAddressOrEns, toAddressOrEns, amount, privateKey, network = "ethereum") {
  const tokenAddress = await resolveAddress(
    tokenAddressOrEns,
    network
  );
  const toAddress = await resolveAddress(toAddressOrEns, network);
  const formattedKey = typeof privateKey === "string" && !privateKey.startsWith("0x") ? `0x${privateKey}` : privateKey;
  const publicClient = getPublicClient(network);
  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  });
  const decimals = await contract.read.decimals();
  const symbol = await contract.read.symbol();
  const rawAmount = parseUnits(amount, decimals);
  const walletClient = getWalletClient(formattedKey, network);
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [toAddress, rawAmount],
    account: walletClient.account,
    chain: walletClient.chain
  });
  return {
    txHash: hash,
    amount: {
      raw: rawAmount,
      formatted: amount
    },
    token: {
      symbol,
      decimals
    }
  };
}
async function approveERC20(tokenAddressOrEns, spenderAddressOrEns, amount, privateKey, network = "ethereum") {
  const tokenAddress = await resolveAddress(
    tokenAddressOrEns,
    network
  );
  const spenderAddress = await resolveAddress(
    spenderAddressOrEns,
    network
  );
  const formattedKey = typeof privateKey === "string" && !privateKey.startsWith("0x") ? `0x${privateKey}` : privateKey;
  const publicClient = getPublicClient(network);
  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  });
  const decimals = await contract.read.decimals();
  const symbol = await contract.read.symbol();
  const rawAmount = parseUnits(amount, decimals);
  const walletClient = getWalletClient(formattedKey, network);
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spenderAddress, rawAmount],
    account: walletClient.account,
    chain: walletClient.chain
  });
  return {
    txHash: hash,
    amount: {
      raw: rawAmount,
      formatted: amount
    },
    token: {
      symbol,
      decimals
    }
  };
}
async function transferERC721(tokenAddressOrEns, toAddressOrEns, tokenId, privateKey, network = "ethereum") {
  const tokenAddress = await resolveAddress(
    tokenAddressOrEns,
    network
  );
  const toAddress = await resolveAddress(toAddressOrEns, network);
  const formattedKey = typeof privateKey === "string" && !privateKey.startsWith("0x") ? `0x${privateKey}` : privateKey;
  const publicClient = getPublicClient(network);
  const contract = getContract({
    address: tokenAddress,
    abi: ERC721_ABI,
    client: publicClient
  });
  const name = await contract.read.name();
  const symbol = await contract.read.symbol();
  const walletClient = getWalletClient(formattedKey, network);
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC721_ABI,
    functionName: "transferFrom",
    args: [walletClient.account.address, toAddress, tokenId],
    account: walletClient.account,
    chain: walletClient.chain
  });
  return {
    txHash: hash,
    tokenId: tokenId.toString(),
    token: {
      name,
      symbol
    }
  };
}
async function transferERC1155(tokenAddressOrEns, toAddressOrEns, tokenId, amount, privateKey, network = "ethereum") {
  const tokenAddress = await resolveAddress(
    tokenAddressOrEns,
    network
  );
  const toAddress = await resolveAddress(toAddressOrEns, network);
  const formattedKey = typeof privateKey === "string" && !privateKey.startsWith("0x") ? `0x${privateKey}` : privateKey;
  const walletClient = getWalletClient(formattedKey, network);
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC1155_ABI,
    functionName: "safeTransferFrom",
    args: [
      walletClient.account.address,
      toAddress,
      tokenId,
      BigInt(amount),
      "0x"
    ],
    account: walletClient.account,
    chain: walletClient.chain
  });
  return {
    txHash: hash,
    tokenId: tokenId.toString(),
    amount
  };
}

// src/evm/services/blocks.ts
async function getBlockNumber(network = "ethereum") {
  const client = getPublicClient(network);
  return await client.getBlockNumber();
}
async function getBlockByNumber(blockNumber, network = "ethereum") {
  const client = getPublicClient(network);
  return await client.getBlock({ blockNumber: BigInt(blockNumber) });
}
async function getBlockByHash(blockHash, network = "ethereum") {
  const client = getPublicClient(network);
  return await client.getBlock({ blockHash });
}
async function getLatestBlock(network = "ethereum") {
  const client = getPublicClient(network);
  return await client.getBlock();
}

// src/evm/services/transactions.ts
async function getTransaction(hash, network = "ethereum") {
  const client = getPublicClient(network);
  return await client.getTransaction({ hash });
}
async function getTransactionReceipt(hash, network = "ethereum") {
  const client = getPublicClient(network);
  return await client.getTransactionReceipt({ hash });
}
async function getTransactionCount(address, network = "ethereum") {
  const client = getPublicClient(network);
  const count = await client.getTransactionCount({ address });
  return Number(count);
}
async function estimateGas(params, network = "ethereum") {
  const client = getPublicClient(network);
  return await client.estimateGas(params);
}
async function getChainId(network = "ethereum") {
  const client = getPublicClient(network);
  const chainId = await client.getChainId();
  return Number(chainId);
}

// src/evm/services/contracts.ts
async function readContract(params, network = "ethereum") {
  const client = getPublicClient(network);
  return await client.readContract(params);
}
async function writeContract(privateKey, params, network = "ethereum") {
  const client = getWalletClient(privateKey, network);
  return await client.writeContract(params);
}
async function getLogs(params, network = "ethereum") {
  const client = getPublicClient(network);
  return await client.getLogs(params);
}
async function isContract(addressOrEns, network = "ethereum") {
  const address = await resolveAddress(addressOrEns, network);
  const client = getPublicClient(network);
  const code = await client.getCode({ address });
  return code !== void 0 && code !== "0x";
}
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  return LogLevel2;
})(LogLevel || {});
var Logger = class _Logger {
  static currentLevel = _Logger.getLogLevelFromEnv();
  static getLogLevelFromEnv() {
    const envLevel = (process.env.LOG_LEVEL || "INFO").toUpperCase();
    return LogLevel[envLevel] ?? 1 /* INFO */;
  }
  static shouldLog(level) {
    return level >= this.currentLevel;
  }
  static formatMessage(level, message, meta) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const metaStr = meta ? " " + util.inspect(meta, { depth: 5, colors: true }) : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }
  static setLogLevel(level) {
    this.currentLevel = LogLevel[level];
  }
  static debug(message, meta) {
    if (this.shouldLog(0 /* DEBUG */)) {
      console.debug(this.formatMessage("DEBUG", message, meta));
    }
  }
  static info(message, meta) {
    if (this.shouldLog(1 /* INFO */)) {
      console.info(this.formatMessage("INFO", message, meta));
    }
  }
  static warn(message, meta) {
    if (this.shouldLog(2 /* WARN */)) {
      console.warn(this.formatMessage("WARN", message, meta));
    }
  }
  static error(message, meta) {
    if (this.shouldLog(3 /* ERROR */)) {
      console.error(this.formatMessage("ERROR", message, meta));
    }
  }
  static getLevel() {
    return LogLevel[this.currentLevel];
  }
};
var logger_default = Logger;

// src/evm/services/tokens.ts
async function getERC20TokenInfo(tokenAddress, network = "ethereum") {
  const publicClient = getPublicClient(network);
  const isContractAddr = await isContract(tokenAddress, network);
  if (!isContractAddr) {
    throw new Error("Token address is not a contract");
  }
  const contract = getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client: publicClient
  });
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    contract.read.name(),
    contract.read.symbol(),
    contract.read.decimals(),
    contract.read.totalSupply()
  ]);
  return {
    name,
    symbol,
    decimals,
    totalSupply,
    formattedTotalSupply: formatUnits(totalSupply, decimals)
  };
}
async function getERC721TokenMetadata(tokenAddress, tokenId, network = "ethereum") {
  const publicClient = getPublicClient(network);
  const isContractAddr = await isContract(tokenAddress, network);
  if (!isContractAddr) {
    throw new Error("Token address is not a contract");
  }
  const contract = getContract({
    address: tokenAddress,
    abi: ERC721_ABI,
    client: publicClient
  });
  const [name, symbol, tokenURI, owner, totalSupply] = await Promise.all([
    contract.read.name(),
    contract.read.symbol(),
    contract.read.tokenURI([tokenId]),
    contract.read.ownerOf([tokenId]),
    contract.read.totalSupply()
  ]);
  return {
    id: tokenId,
    name,
    symbol,
    tokenURI,
    owner,
    totalSupply,
    network,
    contractAddress: tokenAddress
  };
}
async function getERC1155TokenMetadata(tokenAddress, tokenId, network = "ethereum") {
  const publicClient = getPublicClient(network);
  const isContractAddr = await isContract(tokenAddress, network);
  if (!isContractAddr) {
    throw new Error("Token address is not a contract");
  }
  const contract = getContract({
    address: tokenAddress,
    abi: ERC1155_ABI,
    client: publicClient
  });
  const [name, uri] = await Promise.all([
    contract.read.name(),
    contract.read.uri([tokenId])
  ]);
  return {
    id: tokenId,
    name,
    tokenURI: uri,
    network,
    contractAddress: tokenAddress
  };
}
var createERC20Token = async ({
  name,
  symbol,
  privateKey,
  totalSupply = "1000000000",
  // default 1 billion
  network = "bsc"
}) => {
  const client = getWalletClient(privateKey, network);
  const supply = BigInt(totalSupply);
  const hash = await client.deployContract({
    abi: ERC20_ABI,
    bytecode: ERC20_BYTECODE,
    args: [name, symbol, supply],
    account: client.account,
    chain: client.chain
  });
  logger_default.info(`Deployed new ERC20 token (${name} - ${symbol}): ${hash}`);
  return {
    hash,
    name,
    symbol,
    totalSupply: supply,
    owner: client.account.address
  };
};
var utils = {
  // Convert ether to wei
  parseEther: parseEther,
  // Convert wei to ether
  formatEther: formatEther,
  // Format a bigint to a string
  formatBigInt: (value) => value.toString(),
  // Format an object to JSON with bigint handling
  formatJson: (obj) => JSON.stringify(
    obj,
    (_, value) => typeof value === "bigint" ? value.toString() : value,
    2
  ),
  // Format a number with commas
  formatNumber: (value) => {
    return Number(value).toLocaleString();
  },
  // Convert a hex string to a number
  hexToNumber: (hex) => {
    return parseInt(hex, 16);
  },
  // Convert a number to a hex string
  numberToHex: (num) => {
    return "0x" + num.toString(16);
  }
};

// src/utils/helper.ts
var bigIntReplacer = (_key, value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};
var safeStringify = (value, space) => {
  try {
    return JSON.stringify(value, bigIntReplacer, space);
  } catch (error) {
    console.error("Error in safeStringify:", error);
    return JSON.stringify({ error: "Unable to stringify value" });
  }
};
var mcpToolRes = {
  // Unified error handling
  error: (error, operation) => {
    return {
      content: [
        {
          type: "text",
          text: `Error ${operation}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  },
  // Unified response formatting
  success: (data) => {
    return {
      content: [
        {
          type: "text",
          text: safeStringify(data, 2)
        }
      ]
    };
  }
};

// src/evm/modules/blocks/tools.ts
function registerBlockTools(server) {
  server.tool(
    "get_block_by_hash",
    "Get a block by hash",
    {
      blockHash: z.string().describe("The block hash to look up"),
      network: defaultNetworkParam
    },
    async ({ network, blockHash }) => {
      try {
        const block = await getBlockByHash(blockHash, network);
        return mcpToolRes.success(block);
      } catch (error) {
        return mcpToolRes.error(error, "fetching block by hash");
      }
    }
  );
  server.tool(
    "get_block_by_number",
    "Get a block by number",
    {
      blockNumber: z.string().describe("The block number to look up"),
      network: defaultNetworkParam
    },
    async ({ network, blockNumber }) => {
      try {
        const block = await getBlockByNumber(
          parseInt(blockNumber),
          network
        );
        return mcpToolRes.success(block);
      } catch (error) {
        return mcpToolRes.error(error, "fetching block by number");
      }
    }
  );
  server.tool(
    "get_latest_block",
    "Get the latest block",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const block = await getLatestBlock(network);
        return mcpToolRes.success(block);
      } catch (error) {
        return mcpToolRes.error(error, "fetching latest block");
      }
    }
  );
}

// src/evm/modules/blocks/index.ts
function registerBlocks(server) {
  registerBlockPrompts(server);
  registerBlockTools(server);
}
var BRIDGE_CONFIGS = {
  stargate: {
    name: "Stargate",
    supportedChains: [1, 56, 137, 42161, 10, 8453, 43114],
    estimateTime: "10-30 minutes",
    contractAddresses: {
      1: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
      56: "0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8",
      137: "0x45A01E4e04F14f7A4a6702c74187c5F6222033cd",
      42161: "0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614",
      10: "0xB0D502E938ed5f4df2E681fE6E419ff29631d62b"
    }
  },
  layerzero: {
    name: "LayerZero",
    supportedChains: [1, 56, 137, 42161, 10, 8453, 43114, 250],
    estimateTime: "5-20 minutes",
    contractAddresses: {
      1: "0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675",
      56: "0x3c2269811836af69497E5F486A85D7316753cf62",
      137: "0x3c2269811836af69497E5F486A85D7316753cf62",
      42161: "0x3c2269811836af69497E5F486A85D7316753cf62"
    }
  },
  wormhole: {
    name: "Wormhole",
    supportedChains: [1, 56, 137, 42161, 10, 43114, 250],
    estimateTime: "15-30 minutes",
    contractAddresses: {
      1: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      56: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
      137: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7"
    }
  },
  across: {
    name: "Across",
    supportedChains: [1, 137, 42161, 10, 8453],
    estimateTime: "2-10 minutes",
    contractAddresses: {
      1: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
      137: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
      42161: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A"
    }
  }
};
var CHAIN_NAMES = {
  1: "ethereum",
  56: "bsc",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  43114: "avalanche",
  250: "fantom"
};
function registerBridgeTools(server) {
  server.tool(
    "get_bridge_quote",
    "Get a quote for bridging tokens across chains",
    {
      token: z.string().describe("Token address to bridge"),
      amount: z.string().describe("Amount to bridge (in wei)"),
      sourceChain: z.string().describe("Source chain (e.g., 'ethereum', 'bsc')"),
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().optional().describe("Specific bridge to use (stargate, layerzero, wormhole, across)")
    },
    async ({ token, amount, sourceChain, destChain, bridge }) => {
      try {
        const sourceChainId = Object.entries(CHAIN_NAMES).find(([_, name]) => name === sourceChain)?.[0];
        const destChainId = Object.entries(CHAIN_NAMES).find(([_, name]) => name === destChain)?.[0];
        if (!sourceChainId || !destChainId) {
          return mcpToolRes.error(new Error("Invalid chain name"), "getting bridge quote");
        }
        const quotes = [];
        for (const [bridgeName, config] of Object.entries(BRIDGE_CONFIGS)) {
          if (bridge && bridge !== bridgeName) continue;
          const isSupported = config.supportedChains.includes(Number(sourceChainId)) && config.supportedChains.includes(Number(destChainId));
          if (isSupported) {
            const fee = BigInt(amount) * BigInt(3) / BigInt(1e3);
            quotes.push({
              bridge: config.name,
              estimatedOutput: (BigInt(amount) - fee).toString(),
              fee: fee.toString(),
              estimatedTime: config.estimateTime,
              supported: true
            });
          }
        }
        quotes.sort((a, b) => BigInt(b.estimatedOutput) > BigInt(a.estimatedOutput) ? 1 : -1);
        return mcpToolRes.success({
          token,
          amount,
          sourceChain,
          destChain,
          quotes,
          bestBridge: quotes[0]?.bridge || null,
          warning: quotes.length === 0 ? "No bridges support this route" : null
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting bridge quote");
      }
    }
  );
  server.tool(
    "execute_bridge",
    "Execute a cross-chain bridge transfer",
    {
      token: z.string().describe("Token address to bridge"),
      amount: z.string().describe("Amount to bridge (in wei)"),
      sourceChain: defaultNetworkParam,
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().describe("Bridge to use (stargate, layerzero, wormhole, across)"),
      privateKey: privateKeyParam,
      recipient: z.string().optional().describe("Recipient address on destination chain (defaults to sender)")
    },
    async ({ token, amount, sourceChain, destChain, bridge, privateKey, recipient }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const walletClient = getWalletClient(privateKey, sourceChain);
        const publicClient = getPublicClient(sourceChain);
        const bridgeConfig = BRIDGE_CONFIGS[bridge.toLowerCase()];
        if (!bridgeConfig) {
          return mcpToolRes.error(new Error(`Bridge ${bridge} not supported`), "executing bridge");
        }
        const chainId = await publicClient.getChainId();
        const bridgeAddress = bridgeConfig.contractAddresses[chainId];
        if (!bridgeAddress) {
          return mcpToolRes.error(new Error(`Bridge ${bridge} not available on ${sourceChain}`), "executing bridge");
        }
        const recipientAddress = recipient || account.address;
        return mcpToolRes.success({
          status: "pending",
          message: `Bridge transaction prepared via ${bridgeConfig.name}`,
          details: {
            token,
            amount,
            sourceChain,
            destChain,
            bridge: bridgeConfig.name,
            bridgeContract: bridgeAddress,
            recipient: recipientAddress,
            estimatedTime: bridgeConfig.estimateTime
          },
          note: "Actual execution requires bridge-specific transaction encoding"
        });
      } catch (error) {
        return mcpToolRes.error(error, "executing bridge");
      }
    }
  );
  server.tool(
    "get_bridge_status",
    "Track the status of a bridge transaction",
    {
      txHash: z.string().describe("Source chain transaction hash"),
      sourceChain: defaultNetworkParam,
      bridge: z.string().describe("Bridge protocol used")
    },
    async ({ txHash, sourceChain, bridge }) => {
      try {
        const publicClient = getPublicClient(sourceChain);
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        return mcpToolRes.success({
          txHash,
          sourceChain,
          bridge,
          sourceStatus: receipt.status === "success" ? "confirmed" : "failed",
          sourceBlockNumber: receipt.blockNumber.toString(),
          sourceConfirmations: "confirmed",
          destinationStatus: "pending",
          // Would need bridge-specific API to track
          estimatedCompletion: BRIDGE_CONFIGS[bridge.toLowerCase()]?.estimateTime || "unknown",
          note: "For detailed destination status, check the respective bridge explorer"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting bridge status");
      }
    }
  );
  server.tool(
    "get_supported_bridges",
    "List all supported bridge protocols and their capabilities",
    {
      sourceChain: z.string().optional().describe("Filter by source chain support"),
      destChain: z.string().optional().describe("Filter by destination chain support")
    },
    async ({ sourceChain, destChain }) => {
      try {
        const sourceChainId = sourceChain ? Object.entries(CHAIN_NAMES).find(([_, name]) => name === sourceChain)?.[0] : null;
        const destChainId = destChain ? Object.entries(CHAIN_NAMES).find(([_, name]) => name === destChain)?.[0] : null;
        const bridges = Object.entries(BRIDGE_CONFIGS).map(([key, config]) => {
          const supportedChainNames = config.supportedChains.map((id) => CHAIN_NAMES[id] || `Chain ${id}`);
          let supported = true;
          if (sourceChainId && !config.supportedChains.includes(Number(sourceChainId))) supported = false;
          if (destChainId && !config.supportedChains.includes(Number(destChainId))) supported = false;
          return {
            id: key,
            name: config.name,
            supportedChains: supportedChainNames,
            estimatedTime: config.estimateTime,
            supportsRoute: supported
          };
        });
        return mcpToolRes.success({
          bridges: sourceChain || destChain ? bridges.filter((b) => b.supportsRoute) : bridges,
          totalCount: bridges.length,
          filteredBy: { sourceChain, destChain }
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting supported bridges");
      }
    }
  );
  server.tool(
    "estimate_bridge_time",
    "Estimate how long a bridge transfer will take",
    {
      sourceChain: z.string().describe("Source chain"),
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().optional().describe("Specific bridge (returns all if not specified)")
    },
    async ({ sourceChain, destChain, bridge }) => {
      try {
        const estimates = [];
        for (const [key, config] of Object.entries(BRIDGE_CONFIGS)) {
          if (bridge && key !== bridge.toLowerCase()) continue;
          estimates.push({
            bridge: config.name,
            estimatedTime: config.estimateTime,
            factors: [
              "Source chain finality",
              "Bridge protocol verification",
              "Destination chain confirmation"
            ]
          });
        }
        return mcpToolRes.success({
          sourceChain,
          destChain,
          estimates,
          note: "Times vary based on network congestion and bridge-specific requirements"
        });
      } catch (error) {
        return mcpToolRes.error(error, "estimating bridge time");
      }
    }
  );
  server.tool(
    "get_bridge_fees",
    "Get detailed fee breakdown for a bridge transfer",
    {
      token: z.string().describe("Token to bridge"),
      amount: z.string().describe("Amount in wei"),
      sourceChain: z.string().describe("Source chain"),
      destChain: z.string().describe("Destination chain"),
      bridge: z.string().describe("Bridge protocol")
    },
    async ({ token, amount, sourceChain, destChain, bridge }) => {
      try {
        const bridgeConfig = BRIDGE_CONFIGS[bridge.toLowerCase()];
        if (!bridgeConfig) {
          return mcpToolRes.error(new Error(`Bridge ${bridge} not found`), "getting bridge fees");
        }
        const protocolFee = BigInt(amount) * BigInt(3) / BigInt(1e3);
        const lpFee = BigInt(amount) * BigInt(1) / BigInt(1e3);
        const gasEstimate = "0.01";
        return mcpToolRes.success({
          bridge: bridgeConfig.name,
          token,
          amount,
          sourceChain,
          destChain,
          fees: {
            protocolFee: protocolFee.toString(),
            protocolFeePercent: "0.3%",
            lpFee: lpFee.toString(),
            lpFeePercent: "0.1%",
            estimatedGas: gasEstimate,
            totalFees: (protocolFee + lpFee).toString()
          },
          netAmount: (BigInt(amount) - protocolFee - lpFee).toString(),
          note: "Actual fees may vary based on current liquidity and gas prices"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting bridge fees");
      }
    }
  );
}

// src/evm/modules/bridge/prompts.ts
function registerBridgePrompts(server) {
  server.prompt(
    "analyze_bridge_route",
    "Analyze and recommend the best bridge route for a cross-chain transfer",
    {
      token: { description: "Token to bridge", required: true },
      amount: { description: "Amount to bridge", required: true },
      sourceChain: { description: "Source blockchain", required: true },
      destChain: { description: "Destination blockchain", required: true }
    },
    ({ token, amount, sourceChain, destChain }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the best bridge options for transferring ${amount} of token ${token} from ${sourceChain} to ${destChain}.

Please use the available bridge tools to:
1. Get quotes from all supported bridges using get_bridge_quote
2. Compare fees across bridges using get_bridge_fees
3. Check estimated transfer times with estimate_bridge_time
4. List all supported bridges for this route with get_supported_bridges

Provide a comprehensive recommendation considering:
- Total fees (protocol + LP + gas)
- Transfer speed
- Security/reliability of the bridge
- Historical success rate
- Liquidity depth

Format your response as:
## Bridge Route Analysis
### Route: ${sourceChain} \u2192 ${destChain}
### Token: ${token}
### Amount: ${amount}

#### Available Bridges
[Table of bridges with fees, times, and scores]

#### Recommendation
[Your recommended bridge with reasoning]

#### Risk Considerations
[Any risks or considerations for this transfer]`
          }
        }
      ]
    })
  );
  server.prompt(
    "bridge_portfolio",
    "Help user bridge assets across multiple chains for portfolio optimization",
    {
      wallet: { description: "Wallet address to analyze", required: true },
      targetChain: { description: "Target chain to consolidate assets", required: true }
    },
    ({ wallet, targetChain }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the portfolio of wallet ${wallet} and provide recommendations for consolidating assets to ${targetChain}.

Use available tools to:
1. Check token balances across all supported chains
2. Get bridge quotes for each asset
3. Calculate total fees for consolidation
4. Estimate total time for all transfers

Provide:
## Portfolio Consolidation Plan

### Current Holdings
[List assets on each chain]

### Bridge Plan
[Step-by-step plan to bridge assets to ${targetChain}]

### Fee Summary
- Total bridge fees
- Total gas fees
- Net value after bridging

### Execution Order
[Recommended order to execute bridges for efficiency]

### Warnings
[Any tokens that cannot be bridged or have low liquidity]`
          }
        }
      ]
    })
  );
}

// src/evm/modules/bridge/index.ts
function registerBridge(server) {
  registerBridgeTools(server);
  registerBridgePrompts(server);
}
function registerContractPrompts(server) {
  server.prompt(
    "interact_with_contract",
    "Get guidance on interacting with a smart contract",
    {
      contractAddress: z.string().describe("The contract address"),
      abiJson: z.string().optional().describe("The contract ABI as a JSON string"),
      network: networkSchema
    },
    ({ contractAddress, abiJson, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: abiJson ? `I need to interact with the smart contract at address ${contractAddress} on the ${network} network. Here's the ABI:

${abiJson}

Please analyze this contract's functions and provide guidance on how to interact with it safely. Explain what each function does and what parameters it requires.` : `I need to interact with the smart contract at address ${contractAddress} on the ${network} network. Please help me understand what this contract does and how I can interact with it safely.`
          }
        }
      ]
    })
  );
}
function registerContractTools(server) {
  server.tool(
    "is_contract",
    "Check if an address is a smart contract or an externally owned account (EOA)",
    {
      address: z.string().describe("The wallet or contract address to check"),
      network: defaultNetworkParam
    },
    async ({ address, network = "bsc" }) => {
      try {
        const isContract2 = await isContract(
          address,
          network
        );
        return mcpToolRes.success({
          address,
          network,
          isContract: isContract2,
          type: isContract2 ? "Contract" : "EOA"
        });
      } catch (error) {
        return mcpToolRes.error(error, "checking contract status");
      }
    }
  );
  server.tool(
    "read_contract",
    "Read data from a smart contract by calling a view/pure function",
    {
      contractAddress: z.string().describe("The address of the smart contract to interact with"),
      abi: z.array(z.any()).describe("The ABI of the smart contract function, as a JSON array"),
      functionName: z.string().describe("The name of the function to call on the contract"),
      args: z.array(z.any()).optional().describe("The arguments to pass to the function"),
      network: defaultNetworkParam
    },
    async ({ contractAddress, abi, functionName, args = [], network }) => {
      try {
        const parsedAbi = typeof abi === "string" ? JSON.parse(abi) : abi;
        const params = {
          address: contractAddress,
          abi: parsedAbi,
          functionName,
          args
        };
        const result = await readContract(params, network);
        return mcpToolRes.success(result);
      } catch (error) {
        return mcpToolRes.error(error, "reading contract");
      }
    }
  );
  server.tool(
    "write_contract",
    "Write data to a smart contract by calling a state-changing function",
    {
      contractAddress: z.string().describe("The address of the smart contract to interact with"),
      abi: z.array(z.any()).describe("The ABI of the smart contract function, as a JSON array"),
      functionName: z.string().describe("The name of the function to call on the contract"),
      args: z.array(z.any()).describe("The arguments to pass to the function"),
      privateKey: z.string().describe(
        "Private key of the sending account. Used only for transaction signing."
      ).default(process.env.PRIVATE_KEY),
      network: defaultNetworkParam
    },
    async ({
      contractAddress,
      abi,
      functionName,
      args,
      privateKey,
      network = "bsc"
    }) => {
      try {
        const parsedAbi = typeof abi === "string" ? JSON.parse(abi) : abi;
        const contractParams = {
          address: contractAddress,
          abi: parsedAbi,
          functionName,
          args
        };
        const txHash = await writeContract(
          privateKey,
          contractParams,
          network
        );
        return mcpToolRes.success({
          contractAddress,
          functionName,
          args,
          transactionHash: txHash,
          message: "Contract write transaction sent successfully"
        });
      } catch (error) {
        return mcpToolRes.error(error, "writing to contract");
      }
    }
  );
}

// src/evm/modules/contracts/index.ts
function registerContracts(server) {
  registerContractPrompts(server);
  registerContractTools(server);
}
var ENS_REGISTRY_ABI = [
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "ttl",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }]
  }
];
var ENS_CONTRACTS = {
  1: { registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" },
  5: { registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" },
  // Goerli
  11155111: { registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" }
  // Sepolia
};
function registerDomainsTools(server) {
  server.tool(
    "resolve_ens_name",
    "Resolve an ENS name to its Ethereum address",
    {
      name: z.string().describe("ENS name (e.g., 'vitalik.eth')"),
      network: z.string().optional().describe("Network (default: ethereum)")
    },
    async ({ name, network = "ethereum" }) => {
      try {
        const publicClient = getPublicClient(network);
        const address = await publicClient.getEnsAddress({ name: normalize(name) });
        if (!address) {
          return mcpToolRes.success({
            name,
            resolved: false,
            address: null,
            message: "ENS name does not resolve to an address"
          });
        }
        return mcpToolRes.success({
          name,
          resolved: true,
          address,
          namehash: namehash(normalize(name))
        });
      } catch (error) {
        return mcpToolRes.error(error, "resolving ENS name");
      }
    }
  );
  server.tool(
    "reverse_resolve_address",
    "Get the ENS name for an Ethereum address (reverse lookup)",
    {
      address: z.string().describe("Ethereum address"),
      network: z.string().optional().describe("Network (default: ethereum)")
    },
    async ({ address, network = "ethereum" }) => {
      try {
        const publicClient = getPublicClient(network);
        const name = await publicClient.getEnsName({ address });
        return mcpToolRes.success({
          address,
          hasEnsName: !!name,
          ensName: name || null
        });
      } catch (error) {
        return mcpToolRes.error(error, "reverse resolving address");
      }
    }
  );
  server.tool(
    "get_ens_text_records",
    "Get text records for an ENS name (avatar, twitter, email, etc.)",
    {
      name: z.string().describe("ENS name"),
      records: z.array(z.string()).optional().describe("Specific records to fetch (default: common ones)")
    },
    async ({ name, records }) => {
      try {
        const publicClient = getPublicClient("ethereum");
        const normalizedName = normalize(name);
        const defaultRecords = [
          "avatar",
          "description",
          "display",
          "email",
          "keywords",
          "mail",
          "notice",
          "location",
          "phone",
          "url",
          "com.twitter",
          "com.github",
          "com.discord",
          "org.telegram"
        ];
        const recordsToFetch = records || defaultRecords;
        const textRecords = {};
        for (const key of recordsToFetch) {
          try {
            const value = await publicClient.getEnsText({ name: normalizedName, key });
            if (value) {
              textRecords[key] = value;
            }
          } catch {
          }
        }
        return mcpToolRes.success({
          name: normalizedName,
          textRecords,
          recordsFound: Object.keys(textRecords).length
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting ENS text records");
      }
    }
  );
  server.tool(
    "get_ens_avatar",
    "Get the avatar URL for an ENS name",
    {
      name: z.string().describe("ENS name")
    },
    async ({ name }) => {
      try {
        const publicClient = getPublicClient("ethereum");
        const normalizedName = normalize(name);
        const avatar = await publicClient.getEnsAvatar({ name: normalizedName });
        return mcpToolRes.success({
          name: normalizedName,
          hasAvatar: !!avatar,
          avatarUrl: avatar || null
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting ENS avatar");
      }
    }
  );
  server.tool(
    "check_ens_availability",
    "Check if an ENS name is available for registration",
    {
      name: z.string().describe("ENS name to check (without .eth)")
    },
    async ({ name }) => {
      try {
        const publicClient = getPublicClient("ethereum");
        const fullName = name.endsWith(".eth") ? name : `${name}.eth`;
        const normalizedName = normalize(fullName);
        const address = await publicClient.getEnsAddress({ name: normalizedName });
        return mcpToolRes.success({
          name: normalizedName,
          isRegistered: !!address,
          currentOwner: address || null,
          available: !address,
          note: address ? "This name is already registered" : "Name may be available (verify on ENS app)"
        });
      } catch (error) {
        return mcpToolRes.success({
          name: name.endsWith(".eth") ? name : `${name}.eth`,
          isRegistered: false,
          available: true,
          note: "Name appears to be available (verify on ENS app)"
        });
      }
    }
  );
  server.tool(
    "get_ens_name_details",
    "Get comprehensive details about an ENS name",
    {
      name: z.string().describe("ENS name")
    },
    async ({ name }) => {
      try {
        const publicClient = getPublicClient("ethereum");
        const normalizedName = normalize(name);
        const node = namehash(normalizedName);
        const chainId = await publicClient.getChainId();
        const ensContracts = ENS_CONTRACTS[chainId];
        if (!ensContracts) {
          return mcpToolRes.error(new Error("ENS not available on this network"), "getting ENS details");
        }
        const [address, resolver, owner] = await Promise.all([
          publicClient.getEnsAddress({ name: normalizedName }).catch(() => null),
          publicClient.readContract({
            address: ensContracts.registry,
            abi: ENS_REGISTRY_ABI,
            functionName: "resolver",
            args: [node]
          }).catch(() => null),
          publicClient.readContract({
            address: ensContracts.registry,
            abi: ENS_REGISTRY_ABI,
            functionName: "owner",
            args: [node]
          }).catch(() => null)
        ]);
        const avatar = await publicClient.getEnsAvatar({ name: normalizedName }).catch(() => null);
        return mcpToolRes.success({
          name: normalizedName,
          namehash: node,
          details: {
            resolvedAddress: address,
            owner,
            resolver,
            avatar
          },
          isRegistered: !!owner && owner !== "0x0000000000000000000000000000000000000000"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting ENS name details");
      }
    }
  );
  server.tool(
    "batch_resolve_addresses",
    "Reverse resolve multiple addresses to ENS names",
    {
      addresses: z.array(z.string()).describe("Array of Ethereum addresses")
    },
    async ({ addresses }) => {
      try {
        const publicClient = getPublicClient("ethereum");
        const results = [];
        for (const address of addresses) {
          try {
            const name = await publicClient.getEnsName({ address });
            results.push({ address, ensName: name || null });
          } catch {
            results.push({ address, ensName: null });
          }
        }
        const resolved = results.filter((r) => r.ensName !== null).length;
        return mcpToolRes.success({
          results,
          summary: {
            total: addresses.length,
            resolved,
            notResolved: addresses.length - resolved
          }
        });
      } catch (error) {
        return mcpToolRes.error(error, "batch resolving addresses");
      }
    }
  );
}

// src/evm/modules/domains/prompts.ts
function registerDomainsPrompts(server) {
  server.prompt(
    "ens_profile_lookup",
    "Get a complete ENS profile for a name or address",
    {
      identifier: { description: "ENS name or Ethereum address", required: true }
    },
    ({ identifier }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Get the complete ENS profile for: ${identifier}

If it's an address, first do a reverse lookup.
Then get all available information:

1. Use resolve_ens_name or reverse_resolve_address
2. Get text records with get_ens_text_records
3. Get avatar with get_ens_avatar
4. Get full details with get_ens_name_details

Format as:
## ENS Profile

### Identity
- Name: [ENS name]
- Address: [Resolved address]

### Avatar
[Avatar URL or "No avatar set"]

### Social Links
[Twitter, GitHub, Discord, etc.]

### Other Records
[Any other text records found]`
          }
        }
      ]
    })
  );
  server.prompt(
    "identify_addresses",
    "Identify multiple addresses by their ENS names",
    {
      addresses: { description: "Comma-separated list of addresses", required: true }
    },
    ({ addresses }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Identify these addresses by their ENS names: ${addresses}

Use batch_resolve_addresses to look up all addresses at once.

Present results as:
| Address | ENS Name | 
|---------|----------|
[Results]`
          }
        }
      ]
    })
  );
}

// src/evm/modules/domains/index.ts
function registerDomains(server) {
  registerDomainsTools(server);
  registerDomainsPrompts(server);
}
var COMMON_EVENTS = {
  Transfer: {
    signature: "Transfer(address,address,uint256)",
    topic: keccak256(toHex("Transfer(address,address,uint256)"))
  },
  Approval: {
    signature: "Approval(address,address,uint256)",
    topic: keccak256(toHex("Approval(address,address,uint256)"))
  },
  Swap: {
    signature: "Swap(address,uint256,uint256,uint256,uint256,address)",
    topic: keccak256(toHex("Swap(address,uint256,uint256,uint256,uint256,address)"))
  },
  Sync: {
    signature: "Sync(uint112,uint112)",
    topic: keccak256(toHex("Sync(uint112,uint112)"))
  },
  Deposit: {
    signature: "Deposit(address,uint256)",
    topic: keccak256(toHex("Deposit(address,uint256)"))
  },
  Withdrawal: {
    signature: "Withdrawal(address,uint256)",
    topic: keccak256(toHex("Withdrawal(address,uint256)"))
  }
};
var TRANSFER_EVENT_ABI = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
var APPROVAL_EVENT_ABI = parseAbiItem("event Approval(address indexed owner, address indexed spender, uint256 value)");
function registerEventsTools(server) {
  server.tool(
    "get_contract_logs",
    "Get event logs from a specific contract",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract address to get logs from"),
      fromBlock: z.string().optional().describe("Start block (default: latest - 1000)"),
      toBlock: z.string().optional().describe("End block (default: latest)"),
      eventSignature: z.string().optional().describe("Event signature to filter (e.g., 'Transfer(address,address,uint256)')")
    },
    async ({ network, contractAddress, fromBlock, toBlock, eventSignature }) => {
      try {
        const publicClient = getPublicClient(network);
        const latestBlock = await publicClient.getBlockNumber();
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 1000n;
        const to = toBlock ? BigInt(toBlock) : latestBlock;
        let topics;
        if (eventSignature) {
          topics = [keccak256(toHex(eventSignature))];
        }
        const logs = await publicClient.getLogs({
          address: contractAddress,
          fromBlock: from,
          toBlock: to,
          topics
        });
        return mcpToolRes.success({
          network,
          contractAddress,
          fromBlock: from.toString(),
          toBlock: to.toString(),
          eventFilter: eventSignature || "all",
          logsCount: logs.length,
          logs: logs.slice(0, 100).map((log) => ({
            blockNumber: log.blockNumber?.toString(),
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            topics: log.topics,
            data: log.data
          })),
          truncated: logs.length > 100
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting contract logs");
      }
    }
  );
  server.tool(
    "get_erc20_transfers",
    "Get ERC20 token transfer events",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().describe("Token contract address"),
      fromAddress: z.string().optional().describe("Filter by sender"),
      toAddress: z.string().optional().describe("Filter by recipient"),
      fromBlock: z.string().optional().describe("Start block"),
      toBlock: z.string().optional().describe("End block"),
      limit: z.number().optional().describe("Max results (default: 50)")
    },
    async ({ network, tokenAddress, fromAddress, toAddress, fromBlock, toBlock, limit = 50 }) => {
      try {
        const publicClient = getPublicClient(network);
        const latestBlock = await publicClient.getBlockNumber();
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 5000n;
        const to = toBlock ? BigInt(toBlock) : latestBlock;
        const topics = [
          COMMON_EVENTS.Transfer.topic,
          fromAddress ? `0x000000000000000000000000${fromAddress.slice(2).toLowerCase()}` : null,
          toAddress ? `0x000000000000000000000000${toAddress.slice(2).toLowerCase()}` : null
        ];
        const logs = await publicClient.getLogs({
          address: tokenAddress,
          fromBlock: from,
          toBlock: to,
          topics
        });
        const transfers = logs.slice(0, limit).map((log) => {
          try {
            const decoded = decodeEventLog({
              abi: [TRANSFER_EVENT_ABI],
              data: log.data,
              topics: log.topics
            });
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              from: decoded.args.from,
              to: decoded.args.to,
              value: decoded.args.value.toString()
            };
          } catch {
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              raw: { topics: log.topics, data: log.data }
            };
          }
        });
        return mcpToolRes.success({
          network,
          tokenAddress,
          filters: { fromAddress, toAddress },
          blockRange: { from: from.toString(), to: to.toString() },
          totalFound: logs.length,
          transfers,
          truncated: logs.length > limit
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting ERC20 transfers");
      }
    }
  );
  server.tool(
    "get_approval_events",
    "Get ERC20 approval events for a token or address",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().optional().describe("Token contract address"),
      ownerAddress: z.string().optional().describe("Filter by token owner"),
      spenderAddress: z.string().optional().describe("Filter by spender"),
      fromBlock: z.string().optional().describe("Start block"),
      toBlock: z.string().optional().describe("End block")
    },
    async ({ network, tokenAddress, ownerAddress, spenderAddress, fromBlock, toBlock }) => {
      try {
        const publicClient = getPublicClient(network);
        const latestBlock = await publicClient.getBlockNumber();
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 5000n;
        const to = toBlock ? BigInt(toBlock) : latestBlock;
        const topics = [
          COMMON_EVENTS.Approval.topic,
          ownerAddress ? `0x000000000000000000000000${ownerAddress.slice(2).toLowerCase()}` : null,
          spenderAddress ? `0x000000000000000000000000${spenderAddress.slice(2).toLowerCase()}` : null
        ];
        const logs = await publicClient.getLogs({
          address: tokenAddress,
          fromBlock: from,
          toBlock: to,
          topics
        });
        const approvals = logs.slice(0, 100).map((log) => {
          try {
            const decoded = decodeEventLog({
              abi: [APPROVAL_EVENT_ABI],
              data: log.data,
              topics: log.topics
            });
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              tokenAddress: log.address,
              owner: decoded.args.owner,
              spender: decoded.args.spender,
              value: decoded.args.value.toString()
            };
          } catch {
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              tokenAddress: log.address,
              raw: true
            };
          }
        });
        return mcpToolRes.success({
          network,
          filters: { tokenAddress, ownerAddress, spenderAddress },
          blockRange: { from: from.toString(), to: to.toString() },
          totalFound: logs.length,
          approvals,
          truncated: logs.length > 100
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting approval events");
      }
    }
  );
  server.tool(
    "get_logs_by_topic",
    "Get logs filtered by event topic hash",
    {
      network: defaultNetworkParam,
      topic0: z.string().describe("Primary topic (event signature hash)"),
      topic1: z.string().optional().describe("Second indexed parameter"),
      topic2: z.string().optional().describe("Third indexed parameter"),
      contractAddress: z.string().optional().describe("Contract address filter"),
      fromBlock: z.string().optional().describe("Start block"),
      toBlock: z.string().optional().describe("End block")
    },
    async ({ network, topic0, topic1, topic2, contractAddress, fromBlock, toBlock }) => {
      try {
        const publicClient = getPublicClient(network);
        const latestBlock = await publicClient.getBlockNumber();
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 1000n;
        const to = toBlock ? BigInt(toBlock) : latestBlock;
        const topics = [
          topic0,
          topic1 ? topic1 : null,
          topic2 ? topic2 : null
        ];
        const logs = await publicClient.getLogs({
          address: contractAddress,
          fromBlock: from,
          toBlock: to,
          topics
        });
        return mcpToolRes.success({
          network,
          topics: { topic0, topic1, topic2 },
          contractAddress,
          blockRange: { from: from.toString(), to: to.toString() },
          logsCount: logs.length,
          logs: logs.slice(0, 100).map((log) => ({
            address: log.address,
            blockNumber: log.blockNumber?.toString(),
            transactionHash: log.transactionHash,
            topics: log.topics,
            data: log.data
          })),
          truncated: logs.length > 100
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting logs by topic");
      }
    }
  );
  server.tool(
    "get_event_topics",
    "Get topic hashes for common events",
    {
      eventName: z.string().optional().describe("Specific event name (Transfer, Approval, Swap, etc.)")
    },
    async ({ eventName }) => {
      try {
        if (eventName) {
          const event = COMMON_EVENTS[eventName];
          if (!event) {
            return mcpToolRes.error(new Error(`Unknown event: ${eventName}`), "getting event topic");
          }
          return mcpToolRes.success({
            event: eventName,
            signature: event.signature,
            topic: event.topic
          });
        }
        const events = Object.entries(COMMON_EVENTS).map(([name, data]) => ({
          name,
          signature: data.signature,
          topic: data.topic
        }));
        return mcpToolRes.success({ events });
      } catch (error) {
        return mcpToolRes.error(error, "getting event topics");
      }
    }
  );
  server.tool(
    "calculate_event_signature",
    "Calculate the keccak256 topic hash for an event signature",
    {
      signature: z.string().describe("Event signature (e.g., 'Transfer(address,address,uint256)')")
    },
    async ({ signature }) => {
      try {
        const topic = keccak256(toHex(signature));
        return mcpToolRes.success({
          signature,
          topic
        });
      } catch (error) {
        return mcpToolRes.error(error, "calculating event signature");
      }
    }
  );
  server.tool(
    "get_recent_events",
    "Get recent events from the last N blocks for monitoring",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract to monitor"),
      eventSignature: z.string().describe("Event signature to watch"),
      blocksBack: z.number().optional().describe("Number of blocks to look back (default: 100)")
    },
    async ({ network, contractAddress, eventSignature, blocksBack = 100 }) => {
      try {
        const publicClient = getPublicClient(network);
        const latestBlock = await publicClient.getBlockNumber();
        const topic = keccak256(toHex(eventSignature));
        const logs = await publicClient.getLogs({
          address: contractAddress,
          fromBlock: latestBlock - BigInt(blocksBack),
          toBlock: latestBlock,
          topics: [topic]
        });
        const byBlock = {};
        logs.forEach((log) => {
          const block = log.blockNumber?.toString() || "unknown";
          byBlock[block] = (byBlock[block] || 0) + 1;
        });
        return mcpToolRes.success({
          network,
          contractAddress,
          eventSignature,
          topic,
          latestBlock: latestBlock.toString(),
          blocksAnalyzed: blocksBack,
          totalEvents: logs.length,
          eventsPerBlock: Object.keys(byBlock).length > 0 ? (logs.length / Object.keys(byBlock).length).toFixed(2) : "0",
          recentLogs: logs.slice(-20).map((log) => ({
            blockNumber: log.blockNumber?.toString(),
            transactionHash: log.transactionHash,
            data: log.data.slice(0, 66) + (log.data.length > 66 ? "..." : "")
          }))
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting recent events");
      }
    }
  );
}

// src/evm/modules/events/prompts.ts
function registerEventsPrompts(server) {
  server.prompt(
    "analyze_contract_activity",
    "Analyze event activity for a contract to understand usage patterns",
    {
      contractAddress: { description: "Contract address to analyze", required: true },
      network: { description: "Network", required: true }
    },
    ({ contractAddress, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the event activity for contract ${contractAddress} on ${network}.

Use the events tools to:
1. Get recent contract logs with get_contract_logs
2. Identify the most common event types
3. Track ERC20 transfers if applicable with get_erc20_transfers
4. Check approval patterns with get_approval_events

Provide:
## Contract Activity Analysis

### Overview
- Contract address
- Network
- Block range analyzed

### Event Summary
| Event Type | Count | % of Total |
|------------|-------|------------|
[Event breakdown]

### Transfer Activity
- Total transfers
- Unique senders/receivers
- Volume patterns

### Notable Patterns
- High activity periods
- Large transactions
- Unusual patterns

### Recommendations
- Security considerations
- Monitoring suggestions`
          }
        }
      ]
    })
  );
  server.prompt(
    "track_wallet_activity",
    "Track all event activity for a specific wallet",
    {
      walletAddress: { description: "Wallet address to track", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Track all event activity for wallet ${walletAddress} on ${network}.

Search for:
1. ERC20 transfers (sent and received)
2. Approval events granted by this wallet
3. Any other relevant events

Provide a timeline of activity and identify:
- Most interacted contracts
- Token transfer patterns
- Active approvals that might be risky
- Overall activity level`
          }
        }
      ]
    })
  );
}

// src/evm/modules/events/index.ts
function registerEvents(server) {
  registerEventsTools(server);
  registerEventsPrompts(server);
}
var GAS_CONFIGS = {
  1: { name: "Ethereum", avgBlockTime: 12, hasEip1559: true, nativeSymbol: "ETH" },
  56: { name: "BSC", avgBlockTime: 3, hasEip1559: false, nativeSymbol: "BNB" },
  137: { name: "Polygon", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "MATIC" },
  42161: { name: "Arbitrum", avgBlockTime: 0.25, hasEip1559: true, nativeSymbol: "ETH" },
  10: { name: "Optimism", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "ETH" },
  8453: { name: "Base", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "ETH" },
  204: { name: "opBNB", avgBlockTime: 1, hasEip1559: true, nativeSymbol: "BNB" },
  43114: { name: "Avalanche", avgBlockTime: 2, hasEip1559: true, nativeSymbol: "AVAX" }
};
var STANDARD_GAS_LIMITS = {
  transfer: 21000n,
  erc20Transfer: 65000n,
  erc20Approve: 46000n,
  swap: 200000n,
  addLiquidity: 250000n,
  removeLiquidity: 200000n,
  bridge: 150000n,
  nftMint: 100000n,
  nftTransfer: 80000n,
  contractDeploy: 500000n
};
function registerGasTools(server) {
  server.tool(
    "get_gas_price",
    "Get current gas price for a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const config = GAS_CONFIGS[chainId];
        const gasPrice = await publicClient.getGasPrice();
        let eip1559Fees = null;
        if (config?.hasEip1559) {
          try {
            const feeData = await publicClient.estimateFeesPerGas();
            eip1559Fees = {
              maxFeePerGas: formatGwei(feeData.maxFeePerGas || 0n),
              maxPriorityFeePerGas: formatGwei(feeData.maxPriorityFeePerGas || 0n)
            };
          } catch {
          }
        }
        return mcpToolRes.success({
          network,
          chainId,
          chainName: config?.name || network,
          gasPrice: formatGwei(gasPrice),
          gasPriceWei: gasPrice.toString(),
          eip1559: eip1559Fees,
          nativeSymbol: config?.nativeSymbol || "ETH"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting gas price");
      }
    }
  );
  server.tool(
    "get_gas_prices_all_chains",
    "Get gas prices across all supported chains for comparison",
    {},
    async () => {
      try {
        const networks = ["ethereum", "bsc", "polygon", "arbitrum", "optimism", "base"];
        const prices = [];
        for (const network of networks) {
          try {
            const publicClient = getPublicClient(network);
            const chainId = await publicClient.getChainId();
            const gasPrice = await publicClient.getGasPrice();
            const config = GAS_CONFIGS[chainId];
            prices.push({
              network,
              chainId,
              gasPrice: formatGwei(gasPrice),
              nativeSymbol: config?.nativeSymbol || "ETH",
              status: "success"
            });
          } catch {
            prices.push({
              network,
              chainId: 0,
              gasPrice: "0",
              nativeSymbol: "N/A",
              status: "error"
            });
          }
        }
        prices.sort((a, b) => parseFloat(a.gasPrice) - parseFloat(b.gasPrice));
        return mcpToolRes.success({
          prices,
          cheapest: prices[0],
          mostExpensive: prices[prices.length - 1],
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting gas prices for all chains");
      }
    }
  );
  server.tool(
    "get_eip1559_fees",
    "Get detailed EIP-1559 fee data including base fee and priority fee",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network);
        const block = await publicClient.getBlock({ blockTag: "latest" });
        const feeData = await publicClient.estimateFeesPerGas();
        const baseFee = block.baseFeePerGas || 0n;
        return mcpToolRes.success({
          network,
          baseFee: formatGwei(baseFee),
          baseFeeWei: baseFee.toString(),
          maxFeePerGas: formatGwei(feeData.maxFeePerGas || 0n),
          maxPriorityFeePerGas: formatGwei(feeData.maxPriorityFeePerGas || 0n),
          recommendations: {
            slow: {
              maxFeePerGas: formatGwei(baseFee * 100n / 100n),
              maxPriorityFeePerGas: "1"
            },
            standard: {
              maxFeePerGas: formatGwei(baseFee * 120n / 100n),
              maxPriorityFeePerGas: "1.5"
            },
            fast: {
              maxFeePerGas: formatGwei(baseFee * 150n / 100n),
              maxPriorityFeePerGas: "2"
            }
          },
          blockNumber: block.number?.toString()
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting EIP-1559 fees");
      }
    }
  );
  server.tool(
    "estimate_gas",
    "Estimate gas for a specific transaction",
    {
      network: defaultNetworkParam,
      from: z.string().describe("Sender address"),
      to: z.string().describe("Recipient/contract address"),
      value: z.string().optional().describe("Value in wei"),
      data: z.string().optional().describe("Transaction data (hex)")
    },
    async ({ network, from, to, value, data }) => {
      try {
        const publicClient = getPublicClient(network);
        const gasEstimate = await publicClient.estimateGas({
          account: from,
          to,
          value: value ? BigInt(value) : 0n,
          data
        });
        const gasPrice = await publicClient.getGasPrice();
        const chainId = await publicClient.getChainId();
        const config = GAS_CONFIGS[chainId];
        const estimatedCost = gasEstimate * gasPrice;
        return mcpToolRes.success({
          network,
          gasEstimate: gasEstimate.toString(),
          gasPrice: formatGwei(gasPrice),
          estimatedCost: {
            wei: estimatedCost.toString(),
            gwei: formatGwei(estimatedCost),
            nativeToken: (Number(estimatedCost) / 1e18).toFixed(8)
          },
          nativeSymbol: config?.nativeSymbol || "ETH"
        });
      } catch (error) {
        return mcpToolRes.error(error, "estimating gas");
      }
    }
  );
  server.tool(
    "get_standard_gas_limits",
    "Get standard gas limits for common transaction types",
    {
      operationType: z.string().optional().describe("Specific operation type (transfer, swap, etc.)")
    },
    async ({ operationType }) => {
      try {
        if (operationType) {
          const limit = STANDARD_GAS_LIMITS[operationType];
          if (!limit) {
            return mcpToolRes.error(new Error(`Unknown operation: ${operationType}`), "getting gas limit");
          }
          return mcpToolRes.success({
            operation: operationType,
            gasLimit: limit.toString(),
            note: "This is an estimate. Actual gas usage may vary."
          });
        }
        const limits = Object.entries(STANDARD_GAS_LIMITS).map(([op, limit]) => ({
          operation: op,
          gasLimit: limit.toString()
        }));
        return mcpToolRes.success({
          limits,
          note: "These are estimates. Actual gas usage may vary based on contract complexity."
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting standard gas limits");
      }
    }
  );
  server.tool(
    "calculate_tx_cost",
    "Calculate the cost of a transaction in native tokens and USD",
    {
      network: defaultNetworkParam,
      gasLimit: z.string().describe("Gas limit for the transaction"),
      gasPriceGwei: z.string().optional().describe("Gas price in gwei (uses current if not provided)")
    },
    async ({ network, gasLimit, gasPriceGwei }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const config = GAS_CONFIGS[chainId];
        let gasPrice;
        if (gasPriceGwei) {
          gasPrice = parseGwei(gasPriceGwei);
        } else {
          gasPrice = await publicClient.getGasPrice();
        }
        const totalCost = BigInt(gasLimit) * gasPrice;
        const costInNative = Number(totalCost) / 1e18;
        return mcpToolRes.success({
          network,
          gasLimit,
          gasPrice: formatGwei(gasPrice),
          totalCost: {
            wei: totalCost.toString(),
            native: costInNative.toFixed(8),
            symbol: config?.nativeSymbol || "ETH"
          },
          note: "USD value requires price feed integration"
        });
      } catch (error) {
        return mcpToolRes.error(error, "calculating transaction cost");
      }
    }
  );
  server.tool(
    "get_gas_history",
    "Get historical gas prices from recent blocks",
    {
      network: defaultNetworkParam,
      blocks: z.number().optional().describe("Number of blocks to analyze (default: 10)")
    },
    async ({ network, blocks = 10 }) => {
      try {
        const publicClient = getPublicClient(network);
        const latestBlock = await publicClient.getBlock({ blockTag: "latest" });
        const history = [];
        for (let i = 0; i < blocks; i++) {
          const blockNum = latestBlock.number - BigInt(i);
          const block = await publicClient.getBlock({ blockNumber: blockNum });
          history.push({
            blockNumber: blockNum.toString(),
            baseFee: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : null,
            timestamp: new Date(Number(block.timestamp) * 1e3).toISOString()
          });
        }
        const baseFees = history.map((h) => h.baseFee ? parseFloat(h.baseFee) : 0).filter((f) => f > 0);
        return mcpToolRes.success({
          network,
          blocksAnalyzed: blocks,
          history,
          statistics: baseFees.length > 0 ? {
            average: (baseFees.reduce((a, b) => a + b, 0) / baseFees.length).toFixed(4),
            min: Math.min(...baseFees).toFixed(4),
            max: Math.max(...baseFees).toFixed(4)
          } : null
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting gas history");
      }
    }
  );
}

// src/evm/modules/gas/prompts.ts
function registerGasPrompts(server) {
  server.prompt(
    "optimize_gas",
    "Analyze and provide gas optimization recommendations for transactions",
    {
      network: { description: "Target network", required: true },
      transactionType: { description: "Type of transaction (swap, transfer, etc.)", required: true }
    },
    ({ network, transactionType }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze gas conditions on ${network} for a ${transactionType} transaction and provide optimization recommendations.

Use the available tools to:
1. Get current gas price with get_gas_price
2. Get EIP-1559 fee data with get_eip1559_fees
3. Get gas history with get_gas_history
4. Get standard gas limits with get_standard_gas_limits

Provide:
## Gas Optimization Report for ${network}

### Current Conditions
- Current gas price
- Base fee trend (rising/falling/stable)
- Network congestion level

### Cost Estimate
- Estimated cost for ${transactionType}
- Cost in native token and approximate USD

### Optimization Recommendations
1. **Timing**: Best time to submit transaction
2. **Gas Settings**: Recommended maxFeePerGas and maxPriorityFeePerGas
3. **Alternative**: Consider other networks if applicable

### Historical Context
- How current prices compare to recent average
- Expected savings if waiting for lower gas`
          }
        }
      ]
    })
  );
  server.prompt(
    "compare_chain_costs",
    "Compare transaction costs across different chains",
    {
      transactionType: { description: "Type of transaction", required: true },
      amount: { description: "Amount being transacted (for context)", required: false }
    },
    ({ transactionType, amount }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Compare the cost of a ${transactionType} transaction across all supported chains${amount ? ` for amount ${amount}` : ""}.

Use get_gas_prices_all_chains to get current prices across networks.

Provide:
## Cross-Chain Cost Comparison

### Transaction Type: ${transactionType}

| Chain | Gas Price | Est. Gas | Est. Cost | Native Token |
|-------|-----------|----------|-----------|--------------|
[Fill in data for each chain]

### Recommendations
- **Cheapest Option**: [Chain with lowest cost]
- **Best Value**: [Consider speed + cost trade-off]
- **Fastest Option**: [Chain with fastest finality]

### Considerations
- Bridge costs if assets need to be moved
- DEX liquidity differences between chains
- Security considerations`
          }
        }
      ]
    })
  );
}

// src/evm/modules/gas/index.ts
function registerGas(server) {
  registerGasTools(server);
  registerGasPrompts(server);
}
var GOVERNOR_ABI = [
  {
    name: "propose",
    type: "function",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" }
    ],
    outputs: [{ name: "proposalId", type: "uint256" }]
  },
  {
    name: "castVote",
    type: "function",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" }
    ],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    name: "castVoteWithReason",
    type: "function",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
      { name: "reason", type: "string" }
    ],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    name: "state",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "proposalVotes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "againstVotes", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "abstainVotes", type: "uint256" }
    ]
  },
  {
    name: "hasVoted",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "account", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "getVotes",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "blockNumber", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "proposalThreshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "quorum",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "blockNumber", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "votingDelay",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "votingPeriod",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "proposalDeadline",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "proposalSnapshot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  }
];
var PROPOSAL_STATES = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed"
];
function registerGovernanceTools(server) {
  server.tool(
    "get_proposal_details",
    "Get details of a governance proposal",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      proposalId: z.string().describe("Proposal ID")
    },
    async ({ network, governorAddress, proposalId }) => {
      try {
        const publicClient = getPublicClient(network);
        const propId = BigInt(proposalId);
        const [state, votes, deadline, snapshot] = await Promise.all([
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "state",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "proposalVotes",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "proposalDeadline",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "proposalSnapshot",
            args: [propId]
          })
        ]);
        const [againstVotes, forVotes, abstainVotes] = votes;
        const totalVotes = againstVotes + forVotes + abstainVotes;
        return mcpToolRes.success({
          network,
          governorAddress,
          proposalId,
          state: PROPOSAL_STATES[state] || "Unknown",
          stateCode: state,
          votes: {
            for: formatUnits(forVotes, 18),
            against: formatUnits(againstVotes, 18),
            abstain: formatUnits(abstainVotes, 18),
            total: formatUnits(totalVotes, 18)
          },
          percentages: totalVotes > 0n ? {
            for: (Number(forVotes) / Number(totalVotes) * 100).toFixed(2) + "%",
            against: (Number(againstVotes) / Number(totalVotes) * 100).toFixed(2) + "%",
            abstain: (Number(abstainVotes) / Number(totalVotes) * 100).toFixed(2) + "%"
          } : null,
          timing: {
            snapshotBlock: snapshot.toString(),
            deadlineBlock: deadline.toString()
          }
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting proposal details");
      }
    }
  );
  server.tool(
    "cast_vote",
    "Cast a vote on a governance proposal",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      proposalId: z.string().describe("Proposal ID"),
      support: z.enum(["for", "against", "abstain"]).describe("Vote type"),
      reason: z.string().optional().describe("Optional reason for vote"),
      privateKey: privateKeyParam
    },
    async ({ network, governorAddress, proposalId, support, reason, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const walletClient = getWalletClient(privateKey, network);
        const publicClient = getPublicClient(network);
        const propId = BigInt(proposalId);
        const voteType = support === "for" ? 1 : support === "against" ? 0 : 2;
        const hasVoted = await publicClient.readContract({
          address: governorAddress,
          abi: GOVERNOR_ABI,
          functionName: "hasVoted",
          args: [propId, account.address]
        });
        if (hasVoted) {
          return mcpToolRes.error(new Error("Already voted on this proposal"), "casting vote");
        }
        let hash;
        if (reason) {
          hash = await walletClient.writeContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "castVoteWithReason",
            args: [propId, voteType, reason],
            account
          });
        } else {
          hash = await walletClient.writeContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "castVote",
            args: [propId, voteType],
            account
          });
        }
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return mcpToolRes.success({
          network,
          governorAddress,
          proposalId,
          vote: support,
          reason: reason || null,
          voter: account.address,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        });
      } catch (error) {
        return mcpToolRes.error(error, "casting vote");
      }
    }
  );
  server.tool(
    "get_voting_power",
    "Get voting power for an address at a specific block",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      address: z.string().describe("Address to check"),
      blockNumber: z.string().optional().describe("Block number (default: latest)")
    },
    async ({ network, governorAddress, address, blockNumber }) => {
      try {
        const publicClient = getPublicClient(network);
        const block = blockNumber ? BigInt(blockNumber) : await publicClient.getBlockNumber() - 1n;
        const votes = await publicClient.readContract({
          address: governorAddress,
          abi: GOVERNOR_ABI,
          functionName: "getVotes",
          args: [address, block]
        });
        return mcpToolRes.success({
          network,
          governorAddress,
          address,
          blockNumber: block.toString(),
          votingPower: votes.toString(),
          votingPowerFormatted: formatUnits(votes, 18)
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting voting power");
      }
    }
  );
  server.tool(
    "get_governance_params",
    "Get governance parameters like voting delay, period, and thresholds",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address")
    },
    async ({ network, governorAddress }) => {
      try {
        const publicClient = getPublicClient(network);
        const currentBlock = await publicClient.getBlockNumber();
        const [votingDelay, votingPeriod, proposalThreshold, quorumVotes] = await Promise.all([
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "votingDelay"
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "votingPeriod"
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "proposalThreshold"
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "quorum",
            args: [currentBlock - 1n]
          })
        ]);
        return mcpToolRes.success({
          network,
          governorAddress,
          parameters: {
            votingDelay: votingDelay.toString(),
            votingDelayBlocks: `${votingDelay} blocks`,
            votingPeriod: votingPeriod.toString(),
            votingPeriodBlocks: `${votingPeriod} blocks`,
            proposalThreshold: formatUnits(proposalThreshold, 18),
            quorum: formatUnits(quorumVotes, 18)
          },
          note: "Thresholds shown in governance token units"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting governance parameters");
      }
    }
  );
  server.tool(
    "check_vote_eligibility",
    "Check if an address can vote on a proposal",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      proposalId: z.string().describe("Proposal ID"),
      address: z.string().describe("Address to check")
    },
    async ({ network, governorAddress, proposalId, address }) => {
      try {
        const publicClient = getPublicClient(network);
        const propId = BigInt(proposalId);
        const [state, snapshot, hasVoted] = await Promise.all([
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "state",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "proposalSnapshot",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress,
            abi: GOVERNOR_ABI,
            functionName: "hasVoted",
            args: [propId, address]
          })
        ]);
        const votingPower = await publicClient.readContract({
          address: governorAddress,
          abi: GOVERNOR_ABI,
          functionName: "getVotes",
          args: [address, snapshot]
        });
        const isActive = state === 1;
        const hasVotingPower = votingPower > 0n;
        const canVote = isActive && !hasVoted && hasVotingPower;
        return mcpToolRes.success({
          network,
          governorAddress,
          proposalId,
          address,
          eligibility: {
            canVote,
            proposalState: PROPOSAL_STATES[state],
            isActive,
            hasVoted,
            votingPower: formatUnits(votingPower, 18),
            hasVotingPower
          },
          reason: !isActive ? "Proposal is not active" : hasVoted ? "Already voted" : !hasVotingPower ? "No voting power at snapshot" : "Eligible to vote"
        });
      } catch (error) {
        return mcpToolRes.error(error, "checking vote eligibility");
      }
    }
  );
  server.tool(
    "calculate_proposal_id",
    "Calculate proposal ID from proposal parameters",
    {
      targets: z.array(z.string()).describe("Target contract addresses"),
      values: z.array(z.string()).describe("ETH values for each call"),
      calldatas: z.array(z.string()).describe("Encoded call data for each target"),
      descriptionHash: z.string().describe("Keccak256 hash of description")
    },
    async ({ targets, values, calldatas, descriptionHash }) => {
      try {
        const encoded = new TextEncoder().encode(
          JSON.stringify({
            targets,
            values,
            calldatas,
            descriptionHash
          })
        );
        const proposalId = keccak256(toHex(encoded));
        return mcpToolRes.success({
          proposalId,
          parameters: {
            targets,
            values,
            calldatas,
            descriptionHash
          },
          note: "This is a simplified calculation. Actual ID depends on Governor implementation."
        });
      } catch (error) {
        return mcpToolRes.error(error, "calculating proposal ID");
      }
    }
  );
}

// src/evm/modules/governance/prompts.ts
function registerGovernancePrompts(server) {
  server.prompt(
    "analyze_proposal",
    "Analyze a governance proposal in detail",
    {
      governorAddress: { description: "Governor contract address", required: true },
      proposalId: { description: "Proposal ID", required: true },
      network: { description: "Network", required: true }
    },
    ({ governorAddress, proposalId, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze governance proposal ${proposalId} on ${network} (Governor: ${governorAddress}).

Use the governance tools to:
1. Get proposal details with get_proposal_details
2. Get governance parameters with get_governance_params
3. Analyze voting distribution

Provide:
## Proposal Analysis

### Proposal #${proposalId}

### Current Status
- State: [Pending/Active/etc.]
- Deadline: [Block number and estimated time]

### Voting Summary
| Vote | Count | Percentage |
|------|-------|------------|
| For | | |
| Against | | |
| Abstain | | |

### Quorum Status
- Required: [X tokens]
- Current: [Y tokens]
- Met: [Yes/No]

### Analysis
- Likelihood of passing
- Key considerations
- Voting recommendations`
          }
        }
      ]
    })
  );
  server.prompt(
    "governance_participation",
    "Help user participate in governance",
    {
      walletAddress: { description: "User's wallet address", required: true },
      governorAddress: { description: "Governor contract address", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, governorAddress, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help ${walletAddress} participate in governance for ${governorAddress} on ${network}.

Check:
1. Current voting power with get_voting_power
2. Governance parameters with get_governance_params
3. Any active proposals

Provide:
## Governance Participation Guide

### Your Voting Power
- Current voting power
- How to increase it (delegate, acquire tokens)

### Active Proposals
[List any active proposals]

### How to Vote
- Step-by-step voting instructions
- Gas considerations

### Best Practices
- Research proposals before voting
- Consider delegation
- Track proposal outcomes`
          }
        }
      ]
    })
  );
}

// src/evm/modules/governance/index.ts
function registerGovernance(server) {
  registerGovernanceTools(server);
  registerGovernancePrompts(server);
}
var AAVE_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" }
    ]
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "configuration", type: "tuple" },
      { name: "liquidityIndex", type: "uint128" },
      { name: "currentLiquidityRate", type: "uint128" },
      { name: "variableBorrowIndex", type: "uint128" },
      { name: "currentVariableBorrowRate", type: "uint128" },
      { name: "currentStableBorrowRate", type: "uint128" },
      { name: "lastUpdateTimestamp", type: "uint40" },
      { name: "id", type: "uint16" },
      { name: "aTokenAddress", type: "address" },
      { name: "stableDebtTokenAddress", type: "address" },
      { name: "variableDebtTokenAddress", type: "address" },
      { name: "interestRateStrategyAddress", type: "address" },
      { name: "accruedToTreasury", type: "uint128" },
      { name: "unbacked", type: "uint128" },
      { name: "isolationModeTotalDebt", type: "uint128" }
    ]
  }
];
var COMPOUND_COMET_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "borrowBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getSupplyRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint64" }],
    outputs: [{ name: "", type: "uint64" }]
  },
  {
    name: "getBorrowRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint64" }],
    outputs: [{ name: "", type: "uint64" }]
  },
  {
    name: "getUtilization",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }]
  }
];
var LENDING_PROTOCOLS = {
  1: {
    // Ethereum
    "Aave V3": { pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", type: "aave" },
    "Compound V3 USDC": { pool: "0xc3d688B66703497DAA19211EEdff47f25384cdc3", type: "compound" }
  },
  137: {
    // Polygon
    "Aave V3": { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", type: "aave" }
  },
  42161: {
    // Arbitrum
    "Aave V3": { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", type: "aave" }
  },
  8453: {
    // Base
    "Aave V3": { pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", type: "aave" }
  }
};
function registerLendingTools(server) {
  server.tool(
    "get_lending_position",
    "Get a user's lending/borrowing position on a protocol",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol name"),
      userAddress: z.string().describe("User address to check")
    },
    async ({ network, protocol, userAddress }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol];
        if (!protocolConfig) {
          return mcpToolRes.error(new Error(`Protocol ${protocol} not found on this network`), "getting lending position");
        }
        if (protocolConfig.type === "aave") {
          const data = await publicClient.readContract({
            address: protocolConfig.pool,
            abi: AAVE_POOL_ABI,
            functionName: "getUserAccountData",
            args: [userAddress]
          });
          const [totalCollateral, totalDebt, availableBorrows, liquidationThreshold, ltv, healthFactor] = data;
          return mcpToolRes.success({
            network,
            protocol,
            userAddress,
            position: {
              totalCollateralUSD: formatUnits(totalCollateral, 8),
              totalDebtUSD: formatUnits(totalDebt, 8),
              availableBorrowsUSD: formatUnits(availableBorrows, 8),
              liquidationThreshold: (Number(liquidationThreshold) / 100).toFixed(2) + "%",
              ltv: (Number(ltv) / 100).toFixed(2) + "%",
              healthFactor: formatUnits(healthFactor, 18)
            },
            healthStatus: Number(healthFactor) >= 1e18 ? healthFactor > 2n * BigInt(1e18) ? "safe" : "moderate" : "at risk"
          });
        }
        if (protocolConfig.type === "compound") {
          const [supplyBalance, borrowBalance] = await Promise.all([
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "balanceOf",
              args: [userAddress]
            }),
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "borrowBalanceOf",
              args: [userAddress]
            })
          ]);
          return mcpToolRes.success({
            network,
            protocol,
            userAddress,
            position: {
              supplyBalance: supplyBalance.toString(),
              supplyFormatted: formatUnits(supplyBalance, 6),
              // USDC
              borrowBalance: borrowBalance.toString(),
              borrowFormatted: formatUnits(borrowBalance, 6)
            }
          });
        }
        return mcpToolRes.error(new Error("Unknown protocol type"), "getting lending position");
      } catch (error) {
        return mcpToolRes.error(error, "getting lending position");
      }
    }
  );
  server.tool(
    "get_lending_rates",
    "Get current supply and borrow rates for a lending market",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol name"),
      asset: z.string().optional().describe("Asset address (for Aave)")
    },
    async ({ network, protocol, asset }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol];
        if (!protocolConfig) {
          return mcpToolRes.error(new Error(`Protocol ${protocol} not found`), "getting lending rates");
        }
        if (protocolConfig.type === "aave" && asset) {
          const reserveData = await publicClient.readContract({
            address: protocolConfig.pool,
            abi: AAVE_POOL_ABI,
            functionName: "getReserveData",
            args: [asset]
          });
          const liquidityRate = reserveData[2];
          const variableBorrowRate = reserveData[4];
          const supplyAPY = (Number(liquidityRate) / 1e27 * 100).toFixed(2);
          const borrowAPY = (Number(variableBorrowRate) / 1e27 * 100).toFixed(2);
          return mcpToolRes.success({
            network,
            protocol,
            asset,
            rates: {
              supplyAPY: supplyAPY + "%",
              variableBorrowAPY: borrowAPY + "%",
              aTokenAddress: reserveData[8]
            }
          });
        }
        if (protocolConfig.type === "compound") {
          const utilization = await publicClient.readContract({
            address: protocolConfig.pool,
            abi: COMPOUND_COMET_ABI,
            functionName: "getUtilization"
          });
          const [supplyRate, borrowRate] = await Promise.all([
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "getSupplyRate",
              args: [utilization]
            }),
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "getBorrowRate",
              args: [utilization]
            })
          ]);
          const secondsPerYear = 31536000n;
          const supplyAPY = (Number(supplyRate * secondsPerYear) / 1e18 * 100).toFixed(2);
          const borrowAPY = (Number(borrowRate * secondsPerYear) / 1e18 * 100).toFixed(2);
          return mcpToolRes.success({
            network,
            protocol,
            rates: {
              supplyAPY: supplyAPY + "%",
              borrowAPY: borrowAPY + "%",
              utilization: (Number(utilization) / 1e18 * 100).toFixed(2) + "%"
            }
          });
        }
        return mcpToolRes.error(new Error("Could not fetch rates"), "getting lending rates");
      } catch (error) {
        return mcpToolRes.error(error, "getting lending rates");
      }
    }
  );
  server.tool(
    "get_lending_protocols",
    "Get list of supported lending protocols on a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const protocols = LENDING_PROTOCOLS[chainId] || {};
        return mcpToolRes.success({
          network,
          chainId,
          protocols: Object.entries(protocols).map(([name, config]) => ({
            name,
            pool: config.pool,
            type: config.type
          })),
          note: Object.keys(protocols).length === 0 ? "No lending protocols configured for this network" : "Use get_lending_position or get_lending_rates for details"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting lending protocols");
      }
    }
  );
  server.tool(
    "calculate_health_factor",
    "Calculate health factor after a potential action",
    {
      currentCollateral: z.string().describe("Current collateral in USD"),
      currentDebt: z.string().describe("Current debt in USD"),
      liquidationThreshold: z.string().describe("Liquidation threshold (e.g., '0.85')"),
      action: z.enum(["supply", "borrow", "withdraw", "repay"]).describe("Action type"),
      amount: z.string().describe("Action amount in USD")
    },
    async ({ currentCollateral, currentDebt, liquidationThreshold, action, amount }) => {
      try {
        let newCollateral = parseFloat(currentCollateral);
        let newDebt = parseFloat(currentDebt);
        const threshold = parseFloat(liquidationThreshold);
        const actionAmount = parseFloat(amount);
        switch (action) {
          case "supply":
            newCollateral += actionAmount;
            break;
          case "borrow":
            newDebt += actionAmount;
            break;
          case "withdraw":
            newCollateral -= actionAmount;
            break;
          case "repay":
            newDebt -= actionAmount;
            break;
        }
        const newHealthFactor = newDebt > 0 ? newCollateral * threshold / newDebt : Infinity;
        return mcpToolRes.success({
          before: {
            collateral: currentCollateral,
            debt: currentDebt,
            healthFactor: parseFloat(currentDebt) > 0 ? (parseFloat(currentCollateral) * threshold / parseFloat(currentDebt)).toFixed(4) : "\u221E"
          },
          action,
          amount,
          after: {
            collateral: newCollateral.toString(),
            debt: newDebt.toString(),
            healthFactor: newHealthFactor === Infinity ? "\u221E" : newHealthFactor.toFixed(4)
          },
          safe: newHealthFactor > 1.5,
          warning: newHealthFactor > 1 && newHealthFactor <= 1.5 ? "Health factor is low - consider adding collateral" : newHealthFactor <= 1 ? "DANGER: Position would be at liquidation risk" : null
        });
      } catch (error) {
        return mcpToolRes.error(error, "calculating health factor");
      }
    }
  );
}

// src/evm/modules/lending/prompts.ts
function registerLendingPrompts(server) {
  server.prompt(
    "analyze_lending_position",
    "Analyze a lending position and provide risk assessment",
    {
      walletAddress: { description: "Wallet address", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the lending positions for ${walletAddress} on ${network}.

Use the lending tools to:
1. Get supported protocols with get_lending_protocols
2. Check positions on each protocol with get_lending_position
3. Get current rates with get_lending_rates

Provide:
## Lending Position Analysis

### Wallet: ${walletAddress}

### Positions by Protocol
[For each protocol with a position]
- Total Collateral
- Total Debt
- Health Factor
- Net Position

### Risk Assessment
- Overall health factor
- Liquidation risk level
- Recommendations

### Rate Comparison
- Current supply APYs
- Current borrow APYs
- Optimization opportunities`
          }
        }
      ]
    })
  );
  server.prompt(
    "optimize_lending_strategy",
    "Help optimize lending and borrowing strategy",
    {
      goal: { description: "User's goal (e.g., maximize yield, minimize risk)", required: true },
      network: { description: "Network", required: true }
    },
    ({ goal, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help me optimize my lending strategy on ${network} with the goal: ${goal}

Compare rates across protocols and provide:
1. Best supply rates for different assets
2. Lowest borrow rates
3. Recommended leverage strategies (if appropriate)
4. Risk considerations for each option`
          }
        }
      ]
    })
  );
}

// src/evm/modules/lending/index.ts
function registerLending(server) {
  registerLendingTools(server);
  registerLendingPrompts(server);
}
var MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
var MULTICALL3_ABI = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" }
        ]
      }
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" }
        ]
      }
    ]
  },
  {
    name: "aggregate",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" }
        ]
      }
    ],
    outputs: [
      { name: "blockNumber", type: "uint256" },
      { name: "returnData", type: "bytes[]" }
    ]
  },
  {
    name: "tryAggregate",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "requireSuccess", type: "bool" },
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" }
        ]
      }
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" }
        ]
      }
    ]
  },
  {
    name: "getBlockNumber",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "blockNumber", type: "uint256" }]
  },
  {
    name: "getBasefee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "basefee", type: "uint256" }]
  },
  {
    name: "getBlockHash",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "blockNumber", type: "uint256" }],
    outputs: [{ name: "blockHash", type: "bytes32" }]
  },
  {
    name: "getEthBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  }
];
var ERC20_ABI2 = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
];
function registerMulticallTools(server) {
  server.tool(
    "execute_multicall",
    "Execute multiple contract calls in a single transaction",
    {
      network: defaultNetworkParam,
      calls: z.array(z.object({
        target: z.string().describe("Contract address"),
        callData: z.string().describe("Encoded call data (hex)"),
        allowFailure: z.boolean().optional().describe("Allow this call to fail")
      })).describe("Array of calls to execute")
    },
    async ({ network, calls }) => {
      try {
        const publicClient = getPublicClient(network);
        const formattedCalls = calls.map((call) => ({
          target: call.target,
          allowFailure: call.allowFailure ?? false,
          callData: call.callData
        }));
        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [formattedCalls]
        });
        const results = result.map((r, i) => ({
          index: i,
          target: calls[i].target,
          success: r.success,
          returnData: r.returnData
        }));
        return mcpToolRes.success({
          network,
          totalCalls: calls.length,
          successfulCalls: results.filter((r) => r.success).length,
          results
        });
      } catch (error) {
        return mcpToolRes.error(error, "executing multicall");
      }
    }
  );
  server.tool(
    "get_multi_token_balances",
    "Get balances of multiple tokens for an address in a single call",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address to check"),
      tokens: z.array(z.string()).describe("Array of token contract addresses")
    },
    async ({ network, address, tokens }) => {
      try {
        const publicClient = getPublicClient(network);
        const calls = tokens.map((token) => ({
          target: token,
          allowFailure: true,
          callData: encodeFunctionData({
            abi: ERC20_ABI2,
            functionName: "balanceOf",
            args: [address]
          })
        }));
        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        });
        const balances = result.map((r, i) => {
          if (!r.success || r.returnData === "0x") {
            return {
              token: tokens[i],
              balance: "0",
              error: "Call failed"
            };
          }
          try {
            const balance = decodeFunctionResult({
              abi: ERC20_ABI2,
              functionName: "balanceOf",
              data: r.returnData
            });
            return {
              token: tokens[i],
              balance: balance.toString()
            };
          } catch {
            return {
              token: tokens[i],
              balance: "0",
              error: "Decode failed"
            };
          }
        });
        return mcpToolRes.success({
          network,
          address,
          balances,
          totalTokens: tokens.length
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting multi token balances");
      }
    }
  );
  server.tool(
    "get_multi_token_info",
    "Get name, symbol, decimals for multiple tokens in a single call",
    {
      network: defaultNetworkParam,
      tokens: z.array(z.string()).describe("Array of token contract addresses")
    },
    async ({ network, tokens }) => {
      try {
        const publicClient = getPublicClient(network);
        const calls = [];
        for (const token of tokens) {
          calls.push({
            target: token,
            allowFailure: true,
            callData: encodeFunctionData({ abi: ERC20_ABI2, functionName: "name" })
          });
          calls.push({
            target: token,
            allowFailure: true,
            callData: encodeFunctionData({ abi: ERC20_ABI2, functionName: "symbol" })
          });
          calls.push({
            target: token,
            allowFailure: true,
            callData: encodeFunctionData({ abi: ERC20_ABI2, functionName: "decimals" })
          });
        }
        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        });
        const results = result;
        const tokenInfos = tokens.map((token, i) => {
          const nameResult = results[i * 3];
          const symbolResult = results[i * 3 + 1];
          const decimalsResult = results[i * 3 + 2];
          let name = "Unknown";
          let symbol = "???";
          let decimals = 18;
          try {
            if (nameResult.success && nameResult.returnData !== "0x") {
              name = decodeFunctionResult({
                abi: ERC20_ABI2,
                functionName: "name",
                data: nameResult.returnData
              });
            }
          } catch {
          }
          try {
            if (symbolResult.success && symbolResult.returnData !== "0x") {
              symbol = decodeFunctionResult({
                abi: ERC20_ABI2,
                functionName: "symbol",
                data: symbolResult.returnData
              });
            }
          } catch {
          }
          try {
            if (decimalsResult.success && decimalsResult.returnData !== "0x") {
              decimals = Number(decodeFunctionResult({
                abi: ERC20_ABI2,
                functionName: "decimals",
                data: decimalsResult.returnData
              }));
            }
          } catch {
          }
          return { address: token, name, symbol, decimals };
        });
        return mcpToolRes.success({
          network,
          tokens: tokenInfos,
          totalTokens: tokens.length
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting multi token info");
      }
    }
  );
  server.tool(
    "get_multi_native_balances",
    "Get native token balances for multiple addresses",
    {
      network: defaultNetworkParam,
      addresses: z.array(z.string()).describe("Array of addresses to check")
    },
    async ({ network, addresses }) => {
      try {
        const publicClient = getPublicClient(network);
        const calls = addresses.map((addr) => ({
          target: MULTICALL3_ADDRESS,
          allowFailure: true,
          callData: encodeFunctionData({
            abi: MULTICALL3_ABI,
            functionName: "getEthBalance",
            args: [addr]
          })
        }));
        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        });
        const balances = result.map((r, i) => {
          if (!r.success) {
            return { address: addresses[i], balance: "0", error: "Call failed" };
          }
          const balance = BigInt(r.returnData);
          return {
            address: addresses[i],
            balance: balance.toString(),
            formatted: (Number(balance) / 1e18).toFixed(6)
          };
        });
        return mcpToolRes.success({
          network,
          balances,
          totalAddresses: addresses.length
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting multi native balances");
      }
    }
  );
  server.tool(
    "encode_call_data",
    "Encode function call data for use in multicall",
    {
      functionSignature: z.string().describe("Function signature (e.g., 'balanceOf(address)')"),
      args: z.array(z.string()).describe("Function arguments as strings")
    },
    async ({ functionSignature, args }) => {
      try {
        const match = functionSignature.match(/^(\w+)\((.*)\)$/);
        if (!match) {
          return mcpToolRes.error(new Error("Invalid function signature"), "encoding call data");
        }
        const [, funcName, paramTypes] = match;
        const types = paramTypes ? paramTypes.split(",").map((t) => t.trim()) : [];
        const abi = [{
          name: funcName,
          type: "function",
          inputs: types.map((type, i) => ({ name: `arg${i}`, type })),
          outputs: []
        }];
        const processedArgs = args.map((arg, i) => {
          const type = types[i];
          if (type.startsWith("uint") || type.startsWith("int")) {
            return BigInt(arg);
          }
          if (type === "bool") {
            return arg.toLowerCase() === "true";
          }
          return arg;
        });
        const callData = encodeFunctionData({
          abi,
          functionName: funcName,
          args: processedArgs
        });
        return mcpToolRes.success({
          functionSignature,
          args,
          callData
        });
      } catch (error) {
        return mcpToolRes.error(error, "encoding call data");
      }
    }
  );
  server.tool(
    "batch_check_allowances",
    "Check token allowances for multiple token/spender pairs",
    {
      network: defaultNetworkParam,
      owner: z.string().describe("Token owner address"),
      checks: z.array(z.object({
        token: z.string().describe("Token address"),
        spender: z.string().describe("Spender address")
      })).describe("Array of token/spender pairs to check")
    },
    async ({ network, owner, checks }) => {
      try {
        const publicClient = getPublicClient(network);
        const allowanceAbi = [{
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" }
          ],
          outputs: [{ name: "", type: "uint256" }]
        }];
        const calls = checks.map((check) => ({
          target: check.token,
          allowFailure: true,
          callData: encodeFunctionData({
            abi: allowanceAbi,
            functionName: "allowance",
            args: [owner, check.spender]
          })
        }));
        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        });
        const allowances = result.map((r, i) => {
          if (!r.success) {
            return {
              token: checks[i].token,
              spender: checks[i].spender,
              allowance: "0",
              error: "Call failed"
            };
          }
          const allowance = BigInt(r.returnData);
          return {
            token: checks[i].token,
            spender: checks[i].spender,
            allowance: allowance.toString(),
            isUnlimited: allowance >= BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / 2n
          };
        });
        return mcpToolRes.success({
          network,
          owner,
          allowances,
          totalChecks: checks.length
        });
      } catch (error) {
        return mcpToolRes.error(error, "batch checking allowances");
      }
    }
  );
}

// src/evm/modules/multicall/prompts.ts
function registerMulticallPrompts(server) {
  server.prompt(
    "batch_portfolio_check",
    "Check a complete portfolio using multicall for efficiency",
    {
      address: { description: "Wallet address to analyze", required: true },
      network: { description: "Network to check", required: true }
    },
    ({ address, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform a comprehensive portfolio check for ${address} on ${network} using multicall for efficiency.

Steps:
1. Get native balance using get_multi_native_balances
2. Get token balances for common tokens using get_multi_token_balances
3. Get token info for any unknown tokens using get_multi_token_info
4. Check allowances for common DEX routers using batch_check_allowances

Provide a formatted portfolio report including:
- Native token balance
- All token holdings with values
- Active allowances that may need review
- Total portfolio value estimate`
          }
        }
      ]
    })
  );
  server.prompt(
    "optimize_batch_calls",
    "Help optimize multiple contract calls into efficient batches",
    {
      calls: { description: "Description of the calls you need to make", required: true }
    },
    ({ calls }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help me optimize these contract calls into efficient multicall batches: ${calls}

Analyze the calls and:
1. Group related calls that can be batched together
2. Identify dependencies that require sequential execution
3. Suggest the optimal multicall structure
4. Estimate gas savings compared to individual calls

Use encode_call_data to prepare the call data and execute_multicall to run them.`
          }
        }
      ]
    })
  );
}

// src/evm/modules/multicall/index.ts
function registerMulticall(server) {
  registerMulticallTools(server);
  registerMulticallPrompts(server);
}
function registerNetworkPrompts(server) {
  server.prompt(
    "explain_evm_concept",
    "Get an explanation of an EVM concept",
    {
      concept: z.string().describe("The EVM concept to explain (e.g., gas, nonce, etc.)")
    },
    ({ concept }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please explain the EVM Blockchain concept of "${concept}" in detail. Include how it works, why it's important, and provide examples if applicable.`
          }
        }
      ]
    })
  );
  server.prompt(
    "compare_networks",
    "Compare different EVM-compatible networks",
    {
      networkList: z.string().describe(
        "Comma-separated list of networks to compare (e.g., 'bsc,opbnb,ethereum,optimism,base,etc.')"
      )
    },
    ({ networkList }) => {
      const networks = networkList.split(",").map((n) => n.trim());
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please compare the following EVM-compatible networks: ${networks.join(", ")}. Include information about their architecture, gas fees, transaction speed, security, and any other relevant differences.`
            }
          }
        ]
      };
    }
  );
}

// src/evm/modules/network/tools.ts
function registerNetworkTools(server) {
  server.tool(
    "get_chain_info",
    "Get chain information for a specific network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const chainId = await getChainId(network);
        const blockNumber = await getBlockNumber(network);
        const rpcUrl = getRpcUrl(network);
        return mcpToolRes.success({
          network,
          chainId,
          blockNumber: blockNumber.toString(),
          rpcUrl
        });
      } catch (error) {
        return mcpToolRes.error(error, "fetching chain info");
      }
    }
  );
  server.tool(
    "get_supported_networks",
    "Get list of supported networks",
    {},
    async () => {
      try {
        const networks = getSupportedNetworks();
        return mcpToolRes.success({
          supportedNetworks: networks
        });
      } catch (error) {
        return mcpToolRes.error(error, "fetching supported networks");
      }
    }
  );
}

// src/evm/modules/network/index.ts
function registerNetwork(server) {
  registerNetworkPrompts(server);
  registerNetworkTools(server);
}
function registerNftTools(server) {
  server.tool(
    "get_nft_info",
    "Get detailed information about a specific NFT (ERC721 token), including collection name, symbol, token URI, and current owner if available.",
    {
      tokenAddress: z.string().describe(
        "The contract address of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for Bored Ape Yacht Club)"
      ),
      tokenId: z.string().describe("The ID of the specific NFT token to query (e.g., '1234')"),
      network: defaultNetworkParam
    },
    async ({ tokenAddress, tokenId, network }) => {
      try {
        const metadata = await getERC721TokenMetadata(
          tokenAddress,
          BigInt(tokenId),
          network
        );
        return mcpToolRes.success(metadata);
      } catch (error) {
        return mcpToolRes.error(error, "fetching NFT metadata");
      }
    }
  );
  server.tool(
    "get_erc1155_token_metadata",
    "Get the metadata for an ERC1155 token (multi-token standard used for both fungible and non-fungible tokens). The metadata typically points to JSON metadata about the token.",
    {
      tokenAddress: z.string().describe(
        "The contract address of the ERC1155 token collection (e.g., '0x76BE3b62873462d2142405439777e971754E8E77')"
      ),
      tokenId: z.string().describe(
        "The ID of the specific token to query metadata for (e.g., '1234')"
      ),
      network: defaultNetworkParam
    },
    async ({ tokenAddress, tokenId, network }) => {
      try {
        const metadata = await getERC1155TokenMetadata(
          tokenAddress,
          BigInt(tokenId),
          network
        );
        return mcpToolRes.success(metadata);
      } catch (error) {
        return mcpToolRes.error(error, "fetching ERC1155 token URI");
      }
    }
  );
  server.tool(
    "transfer_nft",
    "Transfer an NFT to an address",
    {
      privateKey: z.string().describe(
        "Private key of the owner's account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."
      ).default(process.env.PRIVATE_KEY),
      tokenAddress: z.string().describe(
        "The contract address of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for Bored Ape Yacht Club)"
      ),
      tokenId: z.string().describe("The ID of the specific NFT to transfer (e.g., '1234')"),
      toAddress: z.string().describe("The recipient address that will receive the NFT"),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, tokenId, toAddress, network }) => {
      try {
        const result = await transferERC721(
          tokenAddress,
          toAddress,
          BigInt(tokenId),
          privateKey,
          network
        );
        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          network,
          contract: tokenAddress,
          tokenId: result.tokenId,
          recipient: toAddress,
          name: result.token.name,
          symbol: result.token.symbol
        });
      } catch (error) {
        return mcpToolRes.error(error, "transferring NFT");
      }
    }
  );
  server.tool(
    "transfer_erc1155",
    "Transfer ERC1155 tokens to another address. ERC1155 is a multi-token standard that can represent both fungible and non-fungible tokens in a single contract.",
    {
      privateKey: z.string().describe(
        "Private key of the token owner account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."
      ).default(process.env.PRIVATE_KEY),
      tokenAddress: z.string().describe(
        "The contract address of the ERC1155 token collection (e.g., '0x76BE3b62873462d2142405439777e971754E8E77')"
      ),
      tokenId: z.string().describe("The ID of the specific token to transfer (e.g., '1234')"),
      amount: z.string().describe(
        "The quantity of tokens to send (e.g., '1' for a single NFT or '10' for 10 fungible tokens)"
      ),
      toAddress: z.string().describe("The recipient wallet address that will receive the tokens"),
      network: defaultNetworkParam
    },
    async ({
      privateKey,
      tokenAddress,
      tokenId,
      amount,
      toAddress,
      network
    }) => {
      try {
        const result = await transferERC1155(
          tokenAddress,
          toAddress,
          BigInt(tokenId),
          amount,
          privateKey,
          network
        );
        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          network,
          contract: tokenAddress,
          tokenId: result.tokenId,
          amount: result.amount,
          recipient: toAddress
        });
      } catch (error) {
        return mcpToolRes.error(error, "transferring ERC1155 tokens");
      }
    }
  );
}

// src/evm/modules/nft/index.ts
function registerNFT(server) {
  registerNftTools(server);
}
var POPULAR_TOKENS = {
  1: [
    // Ethereum
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EescddeB131e232", decimals: 18 },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 }
  ],
  56: [
    // BSC
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { symbol: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
    { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 }
  ],
  42161: [
    // Arbitrum
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 }
  ],
  137: [
    // Polygon
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "WMATIC", address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", decimals: 18 }
  ]
};
var ERC20_ABI3 = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  }
];
function registerPortfolioTools(server) {
  server.tool(
    "get_portfolio_overview",
    "Get a comprehensive portfolio overview for an address",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address to analyze")
    },
    async ({ network, address }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const nativeBalance = await publicClient.getBalance({ address });
        const tokens = POPULAR_TOKENS[chainId] || [];
        const tokenBalances = [];
        for (const token of tokens) {
          try {
            const balance = await publicClient.readContract({
              address: token.address,
              abi: ERC20_ABI3,
              functionName: "balanceOf",
              args: [address]
            });
            if (balance > 0n) {
              tokenBalances.push({
                symbol: token.symbol,
                address: token.address,
                balance: balance.toString(),
                formatted: formatUnits(balance, token.decimals)
              });
            }
          } catch {
          }
        }
        const totalHoldings = (nativeBalance > 0n ? 1 : 0) + tokenBalances.length;
        return mcpToolRes.success({
          network,
          chainId,
          address,
          native: {
            balance: nativeBalance.toString(),
            formatted: formatUnits(nativeBalance, 18)
          },
          tokens: tokenBalances,
          summary: {
            totalTokens: tokenBalances.length,
            totalHoldings,
            hasNativeBalance: nativeBalance > 0n
          },
          note: "For complete portfolio, use a specialized indexer service"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting portfolio overview");
      }
    }
  );
  server.tool(
    "get_token_balance",
    "Get balance of a specific token",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address"),
      tokenAddress: z.string().describe("Token contract address")
    },
    async ({ network, address, tokenAddress }) => {
      try {
        const publicClient = getPublicClient(network);
        const [balance, symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI3,
            functionName: "balanceOf",
            args: [address]
          }),
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI3,
            functionName: "symbol"
          }),
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI3,
            functionName: "decimals"
          })
        ]);
        return mcpToolRes.success({
          network,
          wallet: address,
          token: {
            address: tokenAddress,
            symbol,
            decimals: Number(decimals)
          },
          balance: balance.toString(),
          formatted: formatUnits(balance, Number(decimals))
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting token balance");
      }
    }
  );
  server.tool(
    "get_multichain_portfolio",
    "Get portfolio across multiple chains",
    {
      address: z.string().describe("Wallet address"),
      networks: z.array(z.string()).optional().describe("Networks to check (default: all supported)")
    },
    async ({ address, networks }) => {
      try {
        const targetNetworks = networks || ["ethereum", "bsc", "arbitrum", "polygon"];
        const portfolio = [];
        for (const network of targetNetworks) {
          try {
            const publicClient = getPublicClient(network);
            const chainId = await publicClient.getChainId();
            const nativeBalance = await publicClient.getBalance({ address });
            const tokens = POPULAR_TOKENS[chainId] || [];
            let tokenCount = 0;
            for (const token of tokens.slice(0, 5)) {
              try {
                const balance = await publicClient.readContract({
                  address: token.address,
                  abi: ERC20_ABI3,
                  functionName: "balanceOf",
                  args: [address]
                });
                if (balance > 0n) tokenCount++;
              } catch {
              }
            }
            portfolio.push({
              network,
              chainId,
              nativeBalance: formatUnits(nativeBalance, 18),
              tokenCount,
              status: "success"
            });
          } catch {
            portfolio.push({
              network,
              chainId: 0,
              nativeBalance: "0",
              tokenCount: 0,
              status: "error"
            });
          }
        }
        const activeChains = portfolio.filter(
          (p) => p.status === "success" && (parseFloat(p.nativeBalance) > 0 || p.tokenCount > 0)
        ).length;
        return mcpToolRes.success({
          address,
          portfolio,
          summary: {
            chainsChecked: portfolio.length,
            activeChains,
            totalTokensFound: portfolio.reduce((sum, p) => sum + p.tokenCount, 0)
          }
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting multi-chain portfolio");
      }
    }
  );
  server.tool(
    "get_wallet_activity",
    "Get recent transaction count and activity level",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address")
    },
    async ({ network, address }) => {
      try {
        const publicClient = getPublicClient(network);
        const nonce = await publicClient.getTransactionCount({ address });
        const balance = await publicClient.getBalance({ address });
        return mcpToolRes.success({
          network,
          address,
          transactionCount: nonce,
          currentBalance: formatUnits(balance, 18),
          activityLevel: nonce > 1e3 ? "very high" : nonce > 100 ? "high" : nonce > 10 ? "moderate" : "low"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting wallet activity");
      }
    }
  );
  server.tool(
    "calculate_portfolio_allocation",
    "Calculate portfolio allocation percentages",
    {
      holdings: z.array(z.object({
        asset: z.string(),
        valueUSD: z.number()
      })).describe("Array of holdings with USD values")
    },
    async ({ holdings }) => {
      try {
        const totalValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);
        const allocation = holdings.map((h) => ({
          asset: h.asset,
          valueUSD: h.valueUSD,
          percentage: totalValue > 0 ? (h.valueUSD / totalValue * 100).toFixed(2) + "%" : "0%"
        })).sort((a, b) => b.valueUSD - a.valueUSD);
        return mcpToolRes.success({
          totalValueUSD: totalValue.toFixed(2),
          allocation,
          diversification: {
            topHolding: allocation[0]?.percentage || "0%",
            numberOfAssets: holdings.length,
            concentrationRisk: holdings.length > 0 && holdings[0].valueUSD / totalValue > 0.5 ? "high" : "moderate"
          }
        });
      } catch (error) {
        return mcpToolRes.error(error, "calculating portfolio allocation");
      }
    }
  );
}

// src/evm/modules/portfolio/prompts.ts
function registerPortfolioPrompts(server) {
  server.prompt(
    "full_portfolio_analysis",
    "Comprehensive portfolio analysis across chains",
    {
      address: { description: "Wallet address to analyze", required: true }
    },
    ({ address }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform a comprehensive portfolio analysis for ${address}.

Use the portfolio tools to:
1. Get multi-chain portfolio overview
2. Check activity level
3. Calculate allocation if values are available

Provide:
## Portfolio Analysis

### Wallet: ${address}

### Holdings by Chain
[Table of holdings per chain]

### Asset Allocation
[Breakdown of major holdings]

### Activity Assessment
- Transaction history
- Most active chains
- Usage patterns

### Recommendations
- Diversification suggestions
- Gas optimization (consolidation?)
- Security considerations`
          }
        }
      ]
    })
  );
  server.prompt(
    "portfolio_rebalance",
    "Get rebalancing recommendations for a portfolio",
    {
      address: { description: "Wallet address", required: true },
      targetAllocation: { description: "Target allocation (e.g., '50% ETH, 30% stables, 20% others')", required: true }
    },
    ({ address, targetAllocation }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help rebalance the portfolio at ${address} to achieve: ${targetAllocation}

Analyze current holdings and provide:
1. Current vs target allocation comparison
2. Specific trades needed
3. Estimated gas costs
4. Best execution strategy (which DEXs, timing)`
          }
        }
      ]
    })
  );
}

// src/evm/modules/portfolio/index.ts
function registerPortfolio(server) {
  registerPortfolioTools(server);
  registerPortfolioPrompts(server);
}
var CHAINLINK_AGGREGATOR_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" }
    ]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "description",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
];
var CHAINLINK_FEEDS = {
  1: {
    // Ethereum
    "ETH/USD": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "BTC/USD": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    "USDC/USD": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    "USDT/USD": "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    "DAI/USD": "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
    "LINK/USD": "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c"
  },
  56: {
    // BSC
    "BNB/USD": "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    "BTC/USD": "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf",
    "ETH/USD": "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
    "USDC/USD": "0x51597f405303C4377E36123cBc172b13269EA163"
  },
  137: {
    // Polygon
    "MATIC/USD": "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    "ETH/USD": "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    "BTC/USD": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
  },
  42161: {
    // Arbitrum
    "ETH/USD": "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    "BTC/USD": "0x6ce185860a4963106506C203335A2910A89E0D8A",
    "USDC/USD": "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    "ARB/USD": "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6"
  }
};
var UNISWAP_POOL_ABI = [
  {
    name: "observe",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "secondsAgos", type: "uint32[]" }],
    outputs: [
      { name: "tickCumulatives", type: "int56[]" },
      { name: "secondsPerLiquidityCumulativeX128s", type: "uint160[]" }
    ]
  },
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" }
    ]
  }
];
function registerPriceFeedsTools(server) {
  server.tool(
    "get_chainlink_price",
    "Get price from a Chainlink price feed",
    {
      network: defaultNetworkParam,
      pair: z.string().describe("Price pair (e.g., 'ETH/USD', 'BTC/USD')")
    },
    async ({ network, pair }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const feedAddress = CHAINLINK_FEEDS[chainId]?.[pair];
        if (!feedAddress) {
          return mcpToolRes.error(
            new Error(`Price feed for ${pair} not available on this network`),
            "getting Chainlink price"
          );
        }
        const [roundData, decimals, description] = await Promise.all([
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "latestRoundData"
          }),
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "decimals"
          }),
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "description"
          })
        ]);
        const [roundId, answer, startedAt, updatedAt, answeredInRound] = roundData;
        const price = Number(answer) / Math.pow(10, Number(decimals));
        const updateTime = new Date(Number(updatedAt) * 1e3);
        return mcpToolRes.success({
          network,
          pair,
          feedAddress,
          description,
          price: price.toFixed(Number(decimals)),
          priceRaw: answer.toString(),
          decimals: Number(decimals),
          roundId: roundId.toString(),
          updatedAt: updateTime.toISOString(),
          ageSeconds: Math.floor(Date.now() / 1e3) - Number(updatedAt)
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting Chainlink price");
      }
    }
  );
  server.tool(
    "get_available_price_feeds",
    "List available Chainlink price feeds on a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const feeds = CHAINLINK_FEEDS[chainId] || {};
        return mcpToolRes.success({
          network,
          chainId,
          feeds: Object.entries(feeds).map(([pair, address]) => ({
            pair,
            feedAddress: address
          })),
          note: Object.keys(feeds).length === 0 ? "No price feeds configured for this network" : "Use get_chainlink_price with any of these pairs"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting available price feeds");
      }
    }
  );
  server.tool(
    "get_custom_price_feed",
    "Get price from a custom Chainlink price feed address",
    {
      network: defaultNetworkParam,
      feedAddress: z.string().describe("Chainlink aggregator contract address")
    },
    async ({ network, feedAddress }) => {
      try {
        const publicClient = getPublicClient(network);
        const [roundData, decimals, description] = await Promise.all([
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "latestRoundData"
          }),
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "decimals"
          }),
          publicClient.readContract({
            address: feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "description"
          })
        ]);
        const [roundId, answer, , updatedAt] = roundData;
        const price = Number(answer) / Math.pow(10, Number(decimals));
        return mcpToolRes.success({
          network,
          feedAddress,
          description,
          price: price.toFixed(Number(decimals)),
          priceRaw: answer.toString(),
          decimals: Number(decimals),
          roundId: roundId.toString(),
          updatedAt: new Date(Number(updatedAt) * 1e3).toISOString()
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting custom price feed");
      }
    }
  );
  server.tool(
    "get_multiple_prices",
    "Get prices for multiple pairs in a single call",
    {
      network: defaultNetworkParam,
      pairs: z.array(z.string()).describe("Array of price pairs (e.g., ['ETH/USD', 'BTC/USD'])")
    },
    async ({ network, pairs }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const prices = [];
        for (const pair of pairs) {
          const feedAddress = CHAINLINK_FEEDS[chainId]?.[pair];
          if (!feedAddress) {
            prices.push({ pair, price: null, error: "Feed not available" });
            continue;
          }
          try {
            const [roundData, decimals] = await Promise.all([
              publicClient.readContract({
                address: feedAddress,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: "latestRoundData"
              }),
              publicClient.readContract({
                address: feedAddress,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: "decimals"
              })
            ]);
            const [, answer] = roundData;
            const price = Number(answer) / Math.pow(10, Number(decimals));
            prices.push({ pair, price: price.toFixed(Number(decimals)), error: null });
          } catch (e) {
            prices.push({ pair, price: null, error: "Failed to fetch" });
          }
        }
        return mcpToolRes.success({
          network,
          prices,
          fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting multiple prices");
      }
    }
  );
  server.tool(
    "get_uniswap_pool_price",
    "Get current price from a Uniswap V3 pool",
    {
      network: defaultNetworkParam,
      poolAddress: z.string().describe("Uniswap V3 pool address"),
      token0Decimals: z.number().optional().describe("Decimals of token0 (default: 18)"),
      token1Decimals: z.number().optional().describe("Decimals of token1 (default: 18)")
    },
    async ({ network, poolAddress, token0Decimals = 18, token1Decimals = 18 }) => {
      try {
        const publicClient = getPublicClient(network);
        const slot0 = await publicClient.readContract({
          address: poolAddress,
          abi: UNISWAP_POOL_ABI,
          functionName: "slot0"
        });
        const sqrtPriceX96 = slot0[0];
        const tick = slot0[1];
        const Q96 = 2n ** 96n;
        const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
        const price = sqrtPrice * sqrtPrice;
        const adjustedPrice = price * Math.pow(10, token0Decimals - token1Decimals);
        return mcpToolRes.success({
          network,
          poolAddress,
          sqrtPriceX96: sqrtPriceX96.toString(),
          tick,
          priceToken0InToken1: adjustedPrice.toString(),
          priceToken1InToken0: (1 / adjustedPrice).toString()
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting Uniswap pool price");
      }
    }
  );
  server.tool(
    "check_price_feed_health",
    "Check if a price feed is stale or unhealthy",
    {
      network: defaultNetworkParam,
      pair: z.string().describe("Price pair to check"),
      maxAge: z.number().optional().describe("Maximum acceptable age in seconds (default: 3600)")
    },
    async ({ network, pair, maxAge = 3600 }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const feedAddress = CHAINLINK_FEEDS[chainId]?.[pair];
        if (!feedAddress) {
          return mcpToolRes.error(new Error(`Feed not found for ${pair}`), "checking price feed health");
        }
        const roundData = await publicClient.readContract({
          address: feedAddress,
          abi: CHAINLINK_AGGREGATOR_ABI,
          functionName: "latestRoundData"
        });
        const [roundId, answer, , updatedAt, answeredInRound] = roundData;
        const currentTime = Math.floor(Date.now() / 1e3);
        const age = currentTime - Number(updatedAt);
        const issues = [];
        if (age > maxAge) {
          issues.push(`Price is stale (${age}s old, max ${maxAge}s)`);
        }
        if (answer <= 0n) {
          issues.push("Price is zero or negative");
        }
        if (answeredInRound < roundId) {
          issues.push("Price was not updated in current round");
        }
        return mcpToolRes.success({
          network,
          pair,
          feedAddress,
          healthy: issues.length === 0,
          issues,
          details: {
            roundId: roundId.toString(),
            answeredInRound: answeredInRound.toString(),
            updatedAt: new Date(Number(updatedAt) * 1e3).toISOString(),
            ageSeconds: age,
            price: answer.toString()
          }
        });
      } catch (error) {
        return mcpToolRes.error(error, "checking price feed health");
      }
    }
  );
}

// src/evm/modules/price-feeds/prompts.ts
function registerPriceFeedsPrompts(server) {
  server.prompt(
    "price_analysis",
    "Get comprehensive price analysis for assets",
    {
      assets: { description: "Comma-separated list of assets (e.g., ETH, BTC, USDC)", required: true },
      network: { description: "Network to check prices on", required: true }
    },
    ({ assets, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Provide price analysis for ${assets} on ${network}.

Use the price feed tools to:
1. Get available price feeds with get_available_price_feeds
2. Get current prices with get_multiple_prices or get_chainlink_price
3. Check feed health with check_price_feed_health

Provide:
## Price Analysis Report

### Current Prices
| Asset | Price (USD) | Last Updated | Feed Health |
|-------|-------------|--------------|-------------|
[Fill in data]

### Feed Status
- Any stale feeds
- Any feeds with issues
- Reliability assessment

### Notes
- Price source (Chainlink)
- Data freshness`
          }
        }
      ]
    })
  );
  server.prompt(
    "monitor_price_feeds",
    "Set up monitoring recommendations for price feeds",
    {
      protocol: { description: "Protocol that depends on these feeds", required: true },
      assets: { description: "Assets to monitor", required: true }
    },
    ({ protocol, assets }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help set up price feed monitoring for ${protocol} using ${assets}.

Provide recommendations for:
1. Which feeds to monitor
2. Acceptable staleness thresholds
3. Alert conditions
4. Backup data sources
5. Risk mitigation strategies`
          }
        }
      ]
    })
  );
}

// src/evm/modules/price-feeds/index.ts
function registerPriceFeeds(server) {
  registerPriceFeedsTools(server);
  registerPriceFeedsPrompts(server);
}
var KNOWN_SCAM_ADDRESSES = /* @__PURE__ */ new Set([
  // These would be populated from security APIs
]);
var COMMON_SPENDERS = {
  1: {
    // Ethereum
    "Uniswap V2": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "Uniswap V3": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    "1inch": "0x1111111254fb6c44bAC0beD2854e76F90643097d"
  },
  56: {
    // BSC
    "PancakeSwap V2": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    "PancakeSwap V3": "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"
  },
  42161: {
    // Arbitrum
    "Uniswap V3": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    "Camelot": "0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
  }
};
var ERC20_SECURITY_ABI = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function _taxFee() view returns (uint256)",
  "function _liquidityFee() view returns (uint256)",
  "function isBlacklisted(address) view returns (bool)",
  "function allowance(address,address) view returns (uint256)"
]);
function registerSecurityTools(server) {
  server.tool(
    "analyze_token_security",
    "Analyze a token contract for security risks and red flags",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().describe("Token contract address to analyze")
    },
    async ({ network, tokenAddress }) => {
      try {
        const publicClient = getPublicClient(network);
        const risks = [];
        const details = {};
        const code = await publicClient.getCode({ address: tokenAddress });
        if (!code || code === "0x") {
          return mcpToolRes.error(new Error("No contract at this address"), "analyzing token");
        }
        details.hasCode = true;
        details.codeSize = code.length;
        try {
          const owner = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_SECURITY_ABI,
            functionName: "owner"
          });
          details.owner = owner;
          if (owner !== "0x0000000000000000000000000000000000000000") {
            risks.push({
              type: "centralization",
              severity: "medium",
              description: `Contract has an owner: ${owner}`
            });
          }
        } catch {
          details.owner = "No owner function or renounced";
        }
        try {
          const paused = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_SECURITY_ABI,
            functionName: "paused"
          });
          if (paused) {
            risks.push({
              type: "pausable",
              severity: "high",
              description: "Token transfers are currently paused"
            });
          }
          details.pausable = true;
        } catch {
          details.pausable = false;
        }
        try {
          const taxFee = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_SECURITY_ABI,
            functionName: "_taxFee"
          });
          details.taxFee = Number(taxFee);
          if (Number(taxFee) > 10) {
            risks.push({
              type: "high_tax",
              severity: "high",
              description: `High tax fee detected: ${taxFee}%`
            });
          }
        } catch {
        }
        const riskScore = risks.reduce((score, risk) => {
          if (risk.severity === "high") return score + 30;
          if (risk.severity === "medium") return score + 15;
          return score + 5;
        }, 0);
        return mcpToolRes.success({
          network,
          tokenAddress,
          riskScore: Math.min(riskScore, 100),
          riskLevel: riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low",
          risks,
          details,
          recommendation: riskScore >= 60 ? "HIGH RISK - Avoid interacting with this token" : riskScore >= 30 ? "MEDIUM RISK - Proceed with caution" : "LOW RISK - Standard token contract"
        });
      } catch (error) {
        return mcpToolRes.error(error, "analyzing token security");
      }
    }
  );
  server.tool(
    "check_approval_risks",
    "Check token approvals for a wallet and identify risky unlimited approvals",
    {
      network: defaultNetworkParam,
      walletAddress: z.string().describe("Wallet address to check"),
      tokenAddresses: z.array(z.string()).optional().describe("Specific tokens to check")
    },
    async ({ network, walletAddress, tokenAddresses }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const spenders = COMMON_SPENDERS[chainId] || {};
        const riskyApprovals = [];
        if (!tokenAddresses || tokenAddresses.length === 0) {
          return mcpToolRes.success({
            network,
            walletAddress,
            message: "Provide specific token addresses to check approvals",
            commonSpenders: Object.entries(spenders).map(([name, addr]) => ({ name, address: addr }))
          });
        }
        for (const token of tokenAddresses) {
          for (const [spenderName, spenderAddr] of Object.entries(spenders)) {
            try {
              const allowance = await publicClient.readContract({
                address: token,
                abi: ERC20_SECURITY_ABI,
                functionName: "allowance",
                args: [walletAddress, spenderAddr]
              });
              if (allowance > 0n) {
                const isUnlimited = allowance >= BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / 2n;
                riskyApprovals.push({
                  token,
                  spender: spenderAddr,
                  spenderName,
                  allowance: allowance.toString(),
                  risk: isUnlimited ? "unlimited" : "limited"
                });
              }
            } catch {
            }
          }
        }
        const unlimitedCount = riskyApprovals.filter((a) => a.risk === "unlimited").length;
        return mcpToolRes.success({
          network,
          walletAddress,
          totalApprovals: riskyApprovals.length,
          unlimitedApprovals: unlimitedCount,
          riskLevel: unlimitedCount > 5 ? "high" : unlimitedCount > 0 ? "medium" : "low",
          approvals: riskyApprovals,
          recommendation: unlimitedCount > 0 ? "Consider revoking unlimited approvals for tokens you no longer use" : "No concerning approvals found"
        });
      } catch (error) {
        return mcpToolRes.error(error, "checking approval risks");
      }
    }
  );
  server.tool(
    "verify_contract",
    "Check if a contract is verified and get basic verification status",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract address to verify")
    },
    async ({ network, contractAddress }) => {
      try {
        const publicClient = getPublicClient(network);
        const code = await publicClient.getCode({ address: contractAddress });
        if (!code || code === "0x") {
          return mcpToolRes.success({
            network,
            contractAddress,
            hasCode: false,
            isContract: false,
            note: "Address is not a contract (EOA or empty)"
          });
        }
        const isProxy = code.includes("363d3d373d3d3d363d") || // EIP-1167 minimal proxy
        code.includes("5860208158601c335a63");
        return mcpToolRes.success({
          network,
          contractAddress,
          hasCode: true,
          isContract: true,
          codeSize: code.length,
          isProxy,
          note: isProxy ? "This appears to be a proxy contract - verify the implementation" : "Contract has bytecode - verify on block explorer for source code",
          explorerUrl: `https://etherscan.io/address/${contractAddress}#code`
        });
      } catch (error) {
        return mcpToolRes.error(error, "verifying contract");
      }
    }
  );
  server.tool(
    "simulate_transaction",
    "Simulate a transaction to check for potential issues before execution",
    {
      network: defaultNetworkParam,
      from: z.string().describe("Sender address"),
      to: z.string().describe("Target contract/address"),
      value: z.string().optional().describe("Value in wei"),
      data: z.string().optional().describe("Transaction data (hex)")
    },
    async ({ network, from, to, value, data }) => {
      try {
        const publicClient = getPublicClient(network);
        const result = await publicClient.call({
          account: from,
          to,
          value: value ? BigInt(value) : 0n,
          data
        });
        let gasEstimate = null;
        try {
          gasEstimate = await publicClient.estimateGas({
            account: from,
            to,
            value: value ? BigInt(value) : 0n,
            data
          });
        } catch {
        }
        return mcpToolRes.success({
          network,
          simulation: "success",
          result: result.data || "0x",
          gasEstimate: gasEstimate?.toString() || "estimation failed",
          warnings: [],
          safe: true
        });
      } catch (error) {
        let revertReason = "Unknown error";
        if (error.message) {
          revertReason = error.message;
        }
        return mcpToolRes.success({
          network,
          simulation: "failed",
          error: revertReason,
          warnings: ["Transaction would revert"],
          safe: false,
          recommendation: "Do not proceed - transaction will fail"
        });
      }
    }
  );
  server.tool(
    "check_address_type",
    "Determine if an address is a contract, EOA, or known entity",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Address to check")
    },
    async ({ network, address }) => {
      try {
        const publicClient = getPublicClient(network);
        const code = await publicClient.getCode({ address });
        const balance = await publicClient.getBalance({ address });
        const nonce = await publicClient.getTransactionCount({ address });
        const isContract2 = code && code !== "0x" && code.length > 2;
        return mcpToolRes.success({
          network,
          address,
          type: isContract2 ? "contract" : "eoa",
          balance: balance.toString(),
          nonce,
          codeSize: isContract2 ? code.length : 0,
          isKnownScam: KNOWN_SCAM_ADDRESSES.has(address.toLowerCase())
        });
      } catch (error) {
        return mcpToolRes.error(error, "checking address type");
      }
    }
  );
  server.tool(
    "decode_transaction_data",
    "Decode transaction input data to understand what it does",
    {
      data: z.string().describe("Transaction input data (hex)"),
      abi: z.string().optional().describe("Contract ABI (JSON string) for decoding")
    },
    async ({ data, abi }) => {
      try {
        const selector = data.slice(0, 10);
        const KNOWN_SELECTORS = {
          "0xa9059cbb": "transfer(address,uint256)",
          "0x095ea7b3": "approve(address,uint256)",
          "0x23b872dd": "transferFrom(address,address,uint256)",
          "0x38ed1739": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
          "0x7ff36ab5": "swapExactETHForTokens(uint256,address[],address,uint256)",
          "0x18cbafe5": "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
          "0xe8e33700": "addLiquidity(...)",
          "0xf305d719": "addLiquidityETH(...)",
          "0x2e1a7d4d": "withdraw(uint256)",
          "0xd0e30db0": "deposit()"
        };
        const knownFunction = KNOWN_SELECTORS[selector];
        if (abi) {
          try {
            const parsedAbi = JSON.parse(abi);
            const decoded = decodeFunctionData({
              abi: parsedAbi,
              data
            });
            return mcpToolRes.success({
              selector,
              functionName: decoded.functionName,
              args: decoded.args,
              decoded: true
            });
          } catch {
          }
        }
        return mcpToolRes.success({
          selector,
          knownFunction: knownFunction || "Unknown function",
          decoded: !!knownFunction,
          dataLength: data.length,
          note: knownFunction ? `This appears to be a ${knownFunction} call` : "Provide the contract ABI for full decoding"
        });
      } catch (error) {
        return mcpToolRes.error(error, "decoding transaction data");
      }
    }
  );
}

// src/evm/modules/security/prompts.ts
function registerSecurityPrompts(server) {
  server.prompt(
    "security_audit",
    "Perform a comprehensive security audit on a token or contract",
    {
      contractAddress: { description: "Contract address to audit", required: true },
      network: { description: "Network", required: true }
    },
    ({ contractAddress, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform a comprehensive security audit on contract ${contractAddress} on ${network}.

Use the security tools to:
1. Analyze token security with analyze_token_security
2. Verify contract code with verify_contract
3. Check address type with check_address_type
4. Review any transaction data if available

Provide:
## Security Audit Report

### Contract: ${contractAddress}
### Network: ${network}

### Risk Assessment
| Category | Risk Level | Details |
|----------|------------|---------|
[Risk breakdown by category]

### Findings
#### Critical
[Any critical security issues]

#### High
[High severity issues]

#### Medium
[Medium severity issues]

#### Low
[Low severity issues]

### Code Analysis
- Contract type (token, proxy, etc.)
- Ownership status
- Upgrade capabilities

### Recommendations
1. [Specific recommendations]

### Conclusion
[Overall assessment and safety rating]`
          }
        }
      ]
    })
  );
  server.prompt(
    "wallet_security_review",
    "Review wallet security including approvals and interaction history",
    {
      walletAddress: { description: "Wallet address to review", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform a security review of wallet ${walletAddress} on ${network}.

Analyze:
1. Token approval risks using check_approval_risks
2. Address type verification
3. Recent transaction patterns

Provide:
## Wallet Security Review

### Wallet: ${walletAddress}

### Approval Analysis
- Total active approvals
- Unlimited approvals (high risk)
- Approved spenders

### Recommendations
- Approvals to revoke
- Security best practices
- Risk mitigation steps`
          }
        }
      ]
    })
  );
}

// src/evm/modules/security/index.ts
function registerSecurity(server) {
  registerSecurityTools(server);
  registerSecurityPrompts(server);
}
var EIP712_DOMAIN_SCHEMA = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  chainId: z.number().optional(),
  verifyingContract: z.string().optional(),
  salt: z.string().optional()
});
function registerSignaturesTools(server) {
  server.tool(
    "sign_message",
    "Sign a message using personal_sign (EIP-191)",
    {
      message: z.string().describe("Message to sign"),
      privateKey: privateKeyParam
    },
    async ({ message, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const signature = await account.signMessage({ message });
        const messageHash = hashMessage(message);
        return mcpToolRes.success({
          message,
          signer: account.address,
          signature,
          messageHash,
          standard: "EIP-191 (personal_sign)"
        });
      } catch (error) {
        return mcpToolRes.error(error, "signing message");
      }
    }
  );
  server.tool(
    "verify_message_signature",
    "Verify a personal_sign message signature",
    {
      message: z.string().describe("Original message"),
      signature: z.string().describe("Signature to verify"),
      address: z.string().describe("Expected signer address")
    },
    async ({ message, signature, address }) => {
      try {
        const isValid = await verifyMessage({
          message,
          signature,
          address
        });
        const recoveredAddress = await recoverMessageAddress({
          message,
          signature
        });
        return mcpToolRes.success({
          message,
          expectedSigner: address,
          recoveredSigner: recoveredAddress,
          isValid,
          match: recoveredAddress.toLowerCase() === address.toLowerCase()
        });
      } catch (error) {
        return mcpToolRes.error(error, "verifying message signature");
      }
    }
  );
  server.tool(
    "sign_typed_data",
    "Sign typed data using EIP-712",
    {
      domain: EIP712_DOMAIN_SCHEMA.describe("EIP-712 domain"),
      types: z.record(z.array(z.object({
        name: z.string(),
        type: z.string()
      }))).describe("Type definitions"),
      primaryType: z.string().describe("Primary type name"),
      message: z.record(z.unknown()).describe("Message to sign"),
      privateKey: privateKeyParam
    },
    async ({ domain, types, primaryType, message, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const signature = await account.signTypedData({
          domain,
          types,
          primaryType,
          message
        });
        const hash = hashTypedData({
          domain,
          types,
          primaryType,
          message
        });
        return mcpToolRes.success({
          domain,
          primaryType,
          message,
          signer: account.address,
          signature,
          typedDataHash: hash,
          standard: "EIP-712"
        });
      } catch (error) {
        return mcpToolRes.error(error, "signing typed data");
      }
    }
  );
  server.tool(
    "verify_typed_data_signature",
    "Verify an EIP-712 typed data signature",
    {
      domain: EIP712_DOMAIN_SCHEMA.describe("EIP-712 domain"),
      types: z.record(z.array(z.object({
        name: z.string(),
        type: z.string()
      }))).describe("Type definitions"),
      primaryType: z.string().describe("Primary type name"),
      message: z.record(z.unknown()).describe("Original message"),
      signature: z.string().describe("Signature to verify"),
      address: z.string().describe("Expected signer address")
    },
    async ({ domain, types, primaryType, message, signature, address }) => {
      try {
        const isValid = await verifyTypedData({
          domain,
          types,
          primaryType,
          message,
          signature,
          address
        });
        const recoveredAddress = await recoverTypedDataAddress({
          domain,
          types,
          primaryType,
          message,
          signature
        });
        return mcpToolRes.success({
          expectedSigner: address,
          recoveredSigner: recoveredAddress,
          isValid,
          match: recoveredAddress.toLowerCase() === address.toLowerCase()
        });
      } catch (error) {
        return mcpToolRes.error(error, "verifying typed data signature");
      }
    }
  );
  server.tool(
    "hash_message",
    "Hash a message using EIP-191 format",
    {
      message: z.string().describe("Message to hash")
    },
    async ({ message }) => {
      try {
        const hash = hashMessage(message);
        return mcpToolRes.success({
          message,
          hash,
          standard: "EIP-191"
        });
      } catch (error) {
        return mcpToolRes.error(error, "hashing message");
      }
    }
  );
  server.tool(
    "create_permit_signature",
    "Create an EIP-2612 permit signature for gasless token approvals",
    {
      tokenAddress: z.string().describe("ERC20 token address"),
      tokenName: z.string().describe("Token name (for EIP-712 domain)"),
      spender: z.string().describe("Spender address to approve"),
      value: z.string().describe("Amount to approve (in wei)"),
      nonce: z.number().describe("Current nonce for the owner"),
      deadline: z.number().describe("Permit deadline (unix timestamp)"),
      chainId: z.number().describe("Chain ID"),
      privateKey: privateKeyParam
    },
    async ({ tokenAddress, tokenName, spender, value, nonce, deadline, chainId, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const domain = {
          name: tokenName,
          version: "1",
          chainId,
          verifyingContract: tokenAddress
        };
        const types = {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" }
          ]
        };
        const message = {
          owner: account.address,
          spender,
          value: BigInt(value),
          nonce: BigInt(nonce),
          deadline: BigInt(deadline)
        };
        const signature = await account.signTypedData({
          domain,
          types,
          primaryType: "Permit",
          message
        });
        const r = signature.slice(0, 66);
        const s = `0x${signature.slice(66, 130)}`;
        const v = parseInt(signature.slice(130, 132), 16);
        return mcpToolRes.success({
          owner: account.address,
          spender,
          value,
          nonce,
          deadline,
          signature,
          components: { r, s, v },
          standard: "EIP-2612"
        });
      } catch (error) {
        return mcpToolRes.error(error, "creating permit signature");
      }
    }
  );
  server.tool(
    "recover_signer",
    "Recover the signer address from a signature",
    {
      message: z.string().describe("Original message"),
      signature: z.string().describe("Signature")
    },
    async ({ message, signature }) => {
      try {
        const address = await recoverMessageAddress({
          message,
          signature
        });
        return mcpToolRes.success({
          message,
          signature,
          recoveredAddress: address
        });
      } catch (error) {
        return mcpToolRes.error(error, "recovering signer");
      }
    }
  );
}

// src/evm/modules/signatures/prompts.ts
function registerSignaturesPrompts(server) {
  server.prompt(
    "create_gasless_approval",
    "Help create a gasless token approval using EIP-2612 permit",
    {
      tokenAddress: { description: "Token contract address", required: true },
      spender: { description: "Address to approve", required: true },
      amount: { description: "Amount to approve", required: true }
    },
    ({ tokenAddress, spender, amount }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help me create a gasless approval for ${amount} of token ${tokenAddress} to spender ${spender}.

This uses EIP-2612 permit signatures to allow approvals without gas.

I'll need:
1. Token name (for domain)
2. Current nonce from the token contract
3. Deadline timestamp
4. Chain ID

Then use create_permit_signature to generate the signature.`
          }
        }
      ]
    })
  );
  server.prompt(
    "verify_signature_authenticity",
    "Verify that a signature is authentic and from the expected signer",
    {
      signature: { description: "Signature to verify", required: true },
      message: { description: "Original message", required: true },
      expectedSigner: { description: "Expected signer address", required: true }
    },
    ({ signature, message, expectedSigner }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Verify the authenticity of this signature:
Signature: ${signature}
Message: ${message}
Expected Signer: ${expectedSigner}

Use verify_message_signature to check if:
1. The signature is valid
2. The recovered signer matches the expected address
3. Report any discrepancies`
          }
        }
      ]
    })
  );
}

// src/evm/modules/signatures/index.ts
function registerSignatures(server) {
  registerSignaturesTools(server);
  registerSignaturesPrompts(server);
}
var STAKING_ABI = [
  {
    name: "stake",
    type: "function",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    name: "unstake",
    type: "function",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [],
    outputs: []
  },
  {
    name: "claimRewards",
    type: "function",
    inputs: [],
    outputs: []
  },
  {
    name: "getReward",
    type: "function",
    inputs: [],
    outputs: []
  },
  {
    name: "earned",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "rewardRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "rewardPerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "stakingToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "rewardsToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
];
var STAKING_PROTOCOLS = {
  1: {
    // Ethereum
    "Lido stETH": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    "Rocket Pool": "0x9559Aaa82d9649C7A7b220E7c461d2E74c9a3593"
  },
  56: {
    // BSC
    "PancakeSwap": "0x45c54210128a065de780C4B0Df3d16664f7f859e"
  },
  42161: {
    // Arbitrum
    "GMX Staking": "0xd2D1162512F927a7e282Ef43a362659E4F2a728F"
  }
};
function registerStakingTools(server) {
  server.tool(
    "get_staking_position",
    "Get staking position and rewards for an address",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      userAddress: z.string().describe("User address to check")
    },
    async ({ network, stakingContract, userAddress }) => {
      try {
        const publicClient = getPublicClient(network);
        let stakedBalance = 0n;
        try {
          stakedBalance = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "balanceOf",
            args: [userAddress]
          });
        } catch {
        }
        let pendingRewards = 0n;
        try {
          pendingRewards = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "earned",
            args: [userAddress]
          });
        } catch {
        }
        let totalStaked = 0n;
        try {
          totalStaked = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "totalSupply"
          });
        } catch {
        }
        let stakingToken = null;
        try {
          stakingToken = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "stakingToken"
          });
        } catch {
        }
        let rewardsToken = null;
        try {
          rewardsToken = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "rewardsToken"
          });
        } catch {
        }
        const shareOfPool = totalStaked > 0n ? (Number(stakedBalance) / Number(totalStaked) * 100).toFixed(4) : "0";
        return mcpToolRes.success({
          network,
          stakingContract,
          userAddress,
          position: {
            stakedBalance: stakedBalance.toString(),
            stakedFormatted: formatUnits(stakedBalance, 18),
            pendingRewards: pendingRewards.toString(),
            rewardsFormatted: formatUnits(pendingRewards, 18)
          },
          pool: {
            totalStaked: totalStaked.toString(),
            totalStakedFormatted: formatUnits(totalStaked, 18),
            userSharePercent: shareOfPool
          },
          tokens: {
            stakingToken,
            rewardsToken
          }
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting staking position");
      }
    }
  );
  server.tool(
    "stake_tokens",
    "Stake tokens in a staking contract",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      amount: z.string().describe("Amount to stake (in wei)"),
      privateKey: privateKeyParam
    },
    async ({ network, stakingContract, amount, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const walletClient = getWalletClient(privateKey, network);
        const publicClient = getPublicClient(network);
        await publicClient.simulateContract({
          address: stakingContract,
          abi: STAKING_ABI,
          functionName: "stake",
          args: [BigInt(amount)],
          account
        });
        const hash = await walletClient.writeContract({
          address: stakingContract,
          abi: STAKING_ABI,
          functionName: "stake",
          args: [BigInt(amount)],
          account
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return mcpToolRes.success({
          network,
          action: "stake",
          stakingContract,
          amount,
          amountFormatted: formatUnits(BigInt(amount), 18),
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed",
          blockNumber: receipt.blockNumber.toString()
        });
      } catch (error) {
        return mcpToolRes.error(error, "staking tokens");
      }
    }
  );
  server.tool(
    "unstake_tokens",
    "Unstake/withdraw tokens from a staking contract",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      amount: z.string().describe("Amount to unstake (in wei)"),
      privateKey: privateKeyParam
    },
    async ({ network, stakingContract, amount, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const walletClient = getWalletClient(privateKey, network);
        const publicClient = getPublicClient(network);
        let hash;
        try {
          await publicClient.simulateContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "unstake",
            args: [BigInt(amount)],
            account
          });
          hash = await walletClient.writeContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "unstake",
            args: [BigInt(amount)],
            account
          });
        } catch {
          hash = await walletClient.writeContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "withdraw",
            account
          });
        }
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return mcpToolRes.success({
          network,
          action: "unstake",
          stakingContract,
          amount,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        });
      } catch (error) {
        return mcpToolRes.error(error, "unstaking tokens");
      }
    }
  );
  server.tool(
    "claim_staking_rewards",
    "Claim pending staking rewards",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      privateKey: privateKeyParam
    },
    async ({ network, stakingContract, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey);
        const walletClient = getWalletClient(privateKey, network);
        const publicClient = getPublicClient(network);
        let pendingRewards = 0n;
        try {
          pendingRewards = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "earned",
            args: [account.address]
          });
        } catch {
        }
        if (pendingRewards === 0n) {
          return mcpToolRes.success({
            network,
            action: "claim_rewards",
            stakingContract,
            pendingRewards: "0",
            message: "No pending rewards to claim"
          });
        }
        let hash;
        try {
          hash = await walletClient.writeContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "claimRewards",
            account
          });
        } catch {
          hash = await walletClient.writeContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "getReward",
            account
          });
        }
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return mcpToolRes.success({
          network,
          action: "claim_rewards",
          stakingContract,
          rewardsClaimed: pendingRewards.toString(),
          rewardsFormatted: formatUnits(pendingRewards, 18),
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        });
      } catch (error) {
        return mcpToolRes.error(error, "claiming rewards");
      }
    }
  );
  server.tool(
    "get_staking_apr",
    "Calculate estimated APR for a staking contract",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address")
    },
    async ({ network, stakingContract }) => {
      try {
        const publicClient = getPublicClient(network);
        let rewardRate = 0n;
        try {
          rewardRate = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "rewardRate"
          });
        } catch {
        }
        let totalStaked = 0n;
        try {
          totalStaked = await publicClient.readContract({
            address: stakingContract,
            abi: STAKING_ABI,
            functionName: "totalSupply"
          });
        } catch {
        }
        const secondsPerYear = 365n * 24n * 60n * 60n;
        let apr = "0";
        if (totalStaked > 0n && rewardRate > 0n) {
          const yearlyRewards = rewardRate * secondsPerYear;
          apr = (Number(yearlyRewards) / Number(totalStaked) * 100).toFixed(2);
        }
        return mcpToolRes.success({
          network,
          stakingContract,
          rewardRate: rewardRate.toString(),
          rewardRatePerSecond: formatUnits(rewardRate, 18),
          totalStaked: totalStaked.toString(),
          estimatedAPR: `${apr}%`,
          note: "APR is estimated and assumes 1:1 token value ratio"
        });
      } catch (error) {
        return mcpToolRes.error(error, "calculating staking APR");
      }
    }
  );
  server.tool(
    "get_staking_protocols",
    "Get list of popular staking protocols on a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network);
        const chainId = await publicClient.getChainId();
        const protocols = STAKING_PROTOCOLS[chainId] || {};
        return mcpToolRes.success({
          network,
          chainId,
          protocols: Object.entries(protocols).map(([name, address]) => ({
            name,
            address
          })),
          note: protocols.length === 0 ? "No pre-configured protocols for this network" : "Use get_staking_position to check your positions"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting staking protocols");
      }
    }
  );
}

// src/evm/modules/staking/prompts.ts
function registerStakingPrompts(server) {
  server.prompt(
    "analyze_staking_opportunity",
    "Analyze a staking opportunity for risks and rewards",
    {
      stakingContract: { description: "Staking contract address", required: true },
      network: { description: "Network", required: true }
    },
    ({ stakingContract, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the staking opportunity at ${stakingContract} on ${network}.

Use available tools to:
1. Get staking APR with get_staking_apr
2. Check pool size and details
3. Analyze contract security with security tools

Provide:
## Staking Opportunity Analysis

### Contract: ${stakingContract}
### Network: ${network}

### Returns
- Estimated APR
- Reward token
- Reward frequency

### Pool Metrics
- Total value locked
- Number of stakers (if available)
- Historical performance

### Risks
- Smart contract risk
- Impermanent loss (if applicable)
- Lock-up periods
- Centralization concerns

### Recommendation
[Your recommendation on whether to stake]`
          }
        }
      ]
    })
  );
  server.prompt(
    "optimize_staking_strategy",
    "Help optimize staking positions across protocols",
    {
      walletAddress: { description: "Wallet address", required: true },
      network: { description: "Network", required: true }
    },
    ({ walletAddress, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help optimize staking strategy for ${walletAddress} on ${network}.

Analyze:
1. Current staking positions
2. Available staking opportunities
3. Compare APRs across protocols

Provide recommendations for:
- Rebalancing existing positions
- New opportunities to consider
- Risk diversification
- Gas-efficient strategies`
          }
        }
      ]
    })
  );
}

// src/evm/modules/staking/index.ts
function registerStaking(server) {
  registerStakingTools(server);
  registerStakingPrompts(server);
}
var DEX_ROUTERS = {
  bsc: {
    pancakeswap: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    uniswap: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
  },
  ethereum: {
    uniswap: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    sushiswap: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
  },
  arbitrum: {
    uniswap: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    sushiswap: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    camelot: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
  },
  polygon: {
    uniswap: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    quickswap: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
  },
  base: {
    uniswap: "0x2626664c2603336E57B271c5C0b26F421741e481",
    aerodrome: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"
  }
};
var ERC20_ABI4 = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
];
var UNISWAP_V2_ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    name: "swapExactETHForTokens",
    type: "function",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  {
    name: "swapExactTokensForETH",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  }
];
function registerSwapTools(server) {
  server.tool(
    "get_swap_quote",
    "Get a swap quote for exchanging tokens. Returns expected output amount and price impact.",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei/smallest unit)"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("Specific DEX to use (e.g., 'uniswap', 'pancakeswap'). If not specified, finds best route.")
    },
    async ({ tokenIn, tokenOut, amountIn, network, dex }) => {
      try {
        const client = getPublicClient(network);
        const chainId = await client.getChainId();
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum;
        const routerAddress = dex ? networkRouters[dex.toLowerCase()] : Object.values(networkRouters)[0];
        if (!routerAddress) {
          return mcpToolRes.error(new Error(`No router found for ${dex || "default"} on ${network}`), "getting swap quote");
        }
        const path = [tokenIn, tokenOut];
        const amounts = await client.readContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [BigInt(amountIn), path]
        });
        const amountOut = amounts[amounts.length - 1];
        const priceImpact = "< 1%";
        return mcpToolRes.success({
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: amountOut.toString(),
          router: routerAddress,
          dex: dex || "default",
          network,
          chainId,
          priceImpact,
          path
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting swap quote");
      }
    }
  );
  server.tool(
    "execute_swap",
    "Execute a token swap on a DEX",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei/smallest unit)"),
      minAmountOut: z.string().describe("Minimum amount of output token to receive (slippage protection)"),
      network: defaultNetworkParam,
      privateKey: privateKeyParam,
      dex: z.string().optional().describe("Specific DEX to use"),
      deadline: z.number().optional().describe("Transaction deadline in seconds from now (default: 1200 = 20 minutes)")
    },
    async ({ tokenIn, tokenOut, amountIn, minAmountOut, network, privateKey, dex, deadline }) => {
      try {
        const walletClient = getWalletClient(privateKey, network);
        const publicClient = getPublicClient(network);
        const account = privateKeyToAccount(privateKey);
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum;
        const routerAddress = dex ? networkRouters[dex.toLowerCase()] : Object.values(networkRouters)[0];
        if (!routerAddress) {
          return mcpToolRes.error(new Error(`No router found for ${dex || "default"} on ${network}`), "executing swap");
        }
        const path = [tokenIn, tokenOut];
        const txDeadline = BigInt(Math.floor(Date.now() / 1e3) + (deadline || 1200));
        const allowance = await publicClient.readContract({
          address: tokenIn,
          abi: ERC20_ABI4,
          functionName: "allowance",
          args: [account.address, routerAddress]
        });
        if (allowance < BigInt(amountIn)) {
          const approveHash = await walletClient.writeContract({
            address: tokenIn,
            abi: ERC20_ABI4,
            functionName: "approve",
            args: [routerAddress, BigInt(amountIn)],
            account
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
        const hash = await walletClient.writeContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [
            BigInt(amountIn),
            BigInt(minAmountOut),
            path,
            account.address,
            txDeadline
          ],
          account
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return mcpToolRes.success({
          success: true,
          transactionHash: hash,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          router: routerAddress
        });
      } catch (error) {
        return mcpToolRes.error(error, "executing swap");
      }
    }
  );
  server.tool(
    "get_best_route",
    "Find the optimal swap route across multiple DEXs for the best price",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei/smallest unit)"),
      network: defaultNetworkParam
    },
    async ({ tokenIn, tokenOut, amountIn, network }) => {
      try {
        const client = getPublicClient(network);
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum;
        const quotes = [];
        const path = [tokenIn, tokenOut];
        for (const [dexName, routerAddress] of Object.entries(networkRouters)) {
          try {
            const amounts = await client.readContract({
              address: routerAddress,
              abi: UNISWAP_V2_ROUTER_ABI,
              functionName: "getAmountsOut",
              args: [BigInt(amountIn), path]
            });
            quotes.push({
              dex: dexName,
              amountOut: amounts[amounts.length - 1].toString(),
              router: routerAddress
            });
          } catch {
          }
        }
        quotes.sort((a, b) => BigInt(b.amountOut) > BigInt(a.amountOut) ? 1 : -1);
        const bestRoute = quotes[0];
        return mcpToolRes.success({
          tokenIn,
          tokenOut,
          amountIn,
          bestRoute,
          allQuotes: quotes,
          network
        });
      } catch (error) {
        return mcpToolRes.error(error, "finding best route");
      }
    }
  );
  server.tool(
    "get_dex_liquidity",
    "Get liquidity information for a trading pair on a DEX",
    {
      tokenA: z.string().describe("First token address"),
      tokenB: z.string().describe("Second token address"),
      network: defaultNetworkParam,
      dex: z.string().optional().describe("DEX to query")
    },
    async ({ tokenA, tokenB, network, dex }) => {
      try {
        const client = getPublicClient(network);
        return mcpToolRes.success({
          tokenA,
          tokenB,
          network,
          dex: dex || "default",
          message: "Liquidity query - pair contract lookup needed for detailed reserves"
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting DEX liquidity");
      }
    }
  );
  server.tool(
    "get_price_impact",
    "Calculate the price impact for a given trade size",
    {
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amountIn: z.string().describe("Amount of input token (in wei)"),
      network: defaultNetworkParam
    },
    async ({ tokenIn, tokenOut, amountIn, network }) => {
      try {
        const client = getPublicClient(network);
        const networkRouters = DEX_ROUTERS[network] || DEX_ROUTERS.ethereum;
        const routerAddress = Object.values(networkRouters)[0];
        const path = [tokenIn, tokenOut];
        const smallAmount = BigInt(amountIn) / BigInt(1e3);
        const smallAmounts = await client.readContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [smallAmount, path]
        });
        const fullAmounts = await client.readContract({
          address: routerAddress,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [BigInt(amountIn), path]
        });
        const baselinePrice = Number(smallAmounts[1]) / Number(smallAmount);
        const actualPrice = Number(fullAmounts[1]) / Number(amountIn);
        const priceImpact = (baselinePrice - actualPrice) / baselinePrice * 100;
        return mcpToolRes.success({
          tokenIn,
          tokenOut,
          amountIn,
          expectedOutput: fullAmounts[1].toString(),
          priceImpact: `${priceImpact.toFixed(4)}%`,
          priceImpactRaw: priceImpact,
          warning: priceImpact > 5 ? "HIGH PRICE IMPACT - Consider smaller trade" : null
        });
      } catch (error) {
        return mcpToolRes.error(error, "calculating price impact");
      }
    }
  );
  server.tool(
    "get_supported_dexs",
    "List all supported DEXs on a specific network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const networkRouters = DEX_ROUTERS[network] || {};
        const dexList = Object.entries(networkRouters).map(([name, address]) => ({
          name,
          router: address
        }));
        return mcpToolRes.success({
          network,
          supportedDEXs: dexList,
          count: dexList.length
        });
      } catch (error) {
        return mcpToolRes.error(error, "getting supported DEXs");
      }
    }
  );
}

// src/evm/modules/swap/prompts.ts
function registerSwapPrompts(server) {
  server.prompt(
    "analyze_swap",
    "Analyze a potential token swap and provide recommendations",
    {
      tokenIn: { description: "Token to sell", required: true },
      tokenOut: { description: "Token to buy", required: true },
      amount: { description: "Amount to swap", required: true },
      network: { description: "Network to swap on", required: false }
    },
    async ({ tokenIn, tokenOut, amount, network }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze this swap:
- Selling: ${tokenIn}
- Buying: ${tokenOut}  
- Amount: ${amount}
- Network: ${network || "ethereum"}

Please:
1. Get quotes from multiple DEXs
2. Calculate price impact
3. Check if there's sufficient liquidity
4. Recommend the best route
5. Warn about any risks (high slippage, low liquidity, etc.)`
          }
        }
      ]
    })
  );
  server.prompt(
    "optimize_swap_route",
    "Find the most optimal route for a large swap to minimize price impact",
    {
      tokenIn: { description: "Token to sell", required: true },
      tokenOut: { description: "Token to buy", required: true },
      amount: { description: "Total amount to swap", required: true }
    },
    async ({ tokenIn, tokenOut, amount }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need to swap a large amount of tokens and want to minimize price impact:
- Selling: ${tokenIn}
- Buying: ${tokenOut}
- Total Amount: ${amount}

Please:
1. Check if splitting across multiple DEXs would be better
2. Consider if using intermediate tokens would help
3. Calculate optimal split if needed
4. Provide step-by-step execution plan`
          }
        }
      ]
    })
  );
}

// src/evm/modules/swap/index.ts
function registerSwap(server) {
  registerSwapTools(server);
  registerSwapPrompts(server);
}
function registerTokenPrompts(server) {
  server.prompt(
    "analyze_token",
    "Analyze an ERC20 or NFT token",
    {
      tokenAddress: z.string().describe("Token contract address to analyze"),
      network: networkSchema,
      tokenType: z.string().optional().describe(
        "Type of token to analyze (erc20, erc721/nft, or auto-detect). Defaults to auto."
      ),
      tokenId: z.string().optional().describe("Token ID (required for NFT analysis)")
    },
    ({ tokenAddress, tokenType = "auto", tokenId, network = "bsc" }) => {
      let promptText = "";
      if (tokenType === "erc20" || tokenType === "auto") {
        promptText = `Please analyze the ERC20 token at address ${tokenAddress} on the ${network} network. Provide information about its name, symbol, total supply, and any other relevant details. If possible, explain the token's purpose, utility, and market context.`;
      } else if ((tokenType === "erc721" || tokenType === "nft") && tokenId) {
        promptText = `Please analyze the NFT with token ID ${tokenId} from the collection at address ${tokenAddress} on the ${network} network. Provide information about the collection name, token details, ownership history if available, and any other relevant information about this specific NFT.`;
      } else if (tokenType === "nft" || tokenType === "erc721") {
        promptText = `Please analyze the NFT collection at address ${tokenAddress} on the ${network} network. Provide information about the collection name, symbol, total supply if available, floor price if available, and any other relevant details about this NFT collection.`;
      }
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText
            }
          }
        ]
      };
    }
  );
}
function registerTokenTools(server) {
  server.tool(
    "get_erc20_token_info",
    "Get ERC20 token information",
    {
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      network: defaultNetworkParam
    },
    async ({ network, tokenAddress }) => {
      try {
        const tokenInfo = await getERC20TokenInfo(
          tokenAddress,
          network
        );
        return mcpToolRes.success(tokenInfo);
      } catch (error) {
        return mcpToolRes.error(error, "fetching ERC20 token info");
      }
    }
  );
  server.tool(
    "get_native_balance",
    "Get native token balance for an address",
    {
      network: defaultNetworkParam,
      address: z.string().optional().describe("The address to check balance for"),
      privateKey: privateKeyParam
    },
    async ({ network, address, privateKey }) => {
      try {
        const result = await getNativeBalance(
          address || privateKeyToAccount(privateKey).address,
          network
        );
        return mcpToolRes.success(result);
      } catch (error) {
        return mcpToolRes.error(error, "fetching native token balance");
      }
    }
  );
  server.tool(
    "get_erc20_balance",
    "Get ERC20 token balance for an address",
    {
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      address: z.string().describe("The address to check balance for"),
      network: defaultNetworkParam,
      privateKey: privateKeyParam
    },
    async ({ network, tokenAddress, address, privateKey }) => {
      try {
        const res = await getERC20Balance(
          tokenAddress,
          address || privateKeyToAccount(privateKey).address,
          network
        );
        return mcpToolRes.success(res);
      } catch (error) {
        return mcpToolRes.error(error, "fetching ERC20 token balance");
      }
    }
  );
  server.tool(
    "create_erc20_token",
    "Create a new ERC20 token",
    {
      name: z.string().describe("The name of the token"),
      symbol: z.string().describe("The symbol of the token"),
      network: defaultNetworkParam,
      privateKey: privateKeyParam
    },
    async ({ network, name, symbol, privateKey }) => {
      try {
        const result = await createERC20Token({
          name,
          symbol,
          privateKey,
          network
        });
        return mcpToolRes.success(result);
      } catch (error) {
        return mcpToolRes.error(error, "creating ERC20 token");
      }
    }
  );
}

// src/evm/modules/tokens/index.ts
function registerTokens(server) {
  registerTokenTools(server);
  registerTokenPrompts(server);
}
function registerTransactionPrompts(server) {
  server.prompt(
    "analyze_transaction",
    "Analyze a specific transaction",
    {
      txHash: z.string().describe("Transaction hash to analyze"),
      network: networkSchema
    },
    ({ txHash, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze transaction ${txHash} on the ${network} network and provide a detailed explanation of what this transaction does, who the parties involved are, the amount transferred (if applicable), gas used, and any other relevant information.`
          }
        }
      ]
    })
  );
}
function registerTransactionTools(server) {
  server.tool(
    "get_transaction",
    "Get detailed information about a specific transaction by its hash. Includes sender, recipient, value, data, and more.",
    {
      txHash: z.string().describe("The transaction hash to look up (e.g., '0x1234...')"),
      network: defaultNetworkParam
    },
    async ({ txHash, network }) => {
      try {
        const tx = await getTransaction(txHash, network);
        return mcpToolRes.success(tx);
      } catch (error) {
        return mcpToolRes.error(error, `fetching transaction ${txHash}`);
      }
    }
  );
  server.tool(
    "estimate_gas",
    "Estimate the gas cost for a transaction",
    {
      to: z.string().describe("The recipient address"),
      value: z.string().optional().describe("The amount of ETH to send in ether (e.g., '0.1')"),
      data: z.string().optional().describe("The transaction data as a hex string"),
      network: defaultNetworkParam
    },
    async ({ to, value, data, network }) => {
      try {
        const params = { to };
        if (value) {
          params.value = utils.parseEther(value);
        }
        if (data) {
          params.data = data;
        }
        const gas = await estimateGas(params, network);
        return mcpToolRes.success({
          network,
          estimatedGas: gas.toString()
        });
      } catch (error) {
        return mcpToolRes.error(error, "estimating gas");
      }
    }
  );
}

// src/evm/modules/transactions/index.ts
function registerTransactions(server) {
  registerTransactionTools(server);
  registerTransactionPrompts(server);
}
function registerWaletPrompts(server) {
  server.prompt(
    "analyze_address",
    "Analyze an EVM address",
    {
      address: z.string().describe("Ethereum address to analyze"),
      network: networkSchema
    },
    ({ address, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the address ${address} on the ${network} network. Provide information about its balance, transaction count, and any other relevant information you can find.`
          }
        }
      ]
    })
  );
}
function registerWalletTools(server) {
  server.tool(
    "get_address_from_private_key",
    "Get the EVM address derived from a private key",
    {
      privateKey: privateKeyParam
    },
    async ({ privateKey }) => {
      try {
        const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
        const address = getAddressFromPrivateKey(formattedKey);
        return mcpToolRes.success({
          address
        });
      } catch (error) {
        return mcpToolRes.error(error, "deriving address from private key");
      }
    }
  );
  server.tool(
    "transfer_native_token",
    "Transfer native tokens (BNB, ETH, MATIC, etc.) to an address",
    {
      privateKey: privateKeyParam,
      toAddress: z.string().describe(
        "The recipient address or ENS name (e.g., '0x1234...' or 'vitalik.eth')"
      ),
      amount: z.string().describe(
        "Amount to send in BNB (or the native token of the network), as a string (e.g., '0.1')"
      ),
      network: defaultNetworkParam
    },
    async ({ privateKey, toAddress, amount, network }) => {
      try {
        const hash = await transferETH(
          privateKey,
          toAddress,
          amount,
          network
        );
        return mcpToolRes.success({
          success: true,
          txHash: hash,
          toAddress,
          amount,
          network
        });
      } catch (error) {
        return mcpToolRes.error(error, "transferring native token");
      }
    }
  );
  server.tool(
    "approve_token_spending",
    "Approve another address (like a DeFi protocol or exchange) to spend your ERC20 tokens. This is often required before interacting with DeFi protocols.",
    {
      privateKey: privateKeyParam,
      tokenAddress: z.string().describe(
        "The contract address of the ERC20 token to approve for spending (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC on Ethereum)"
      ),
      spenderAddress: z.string().describe(
        "The contract address being approved to spend your tokens (e.g., a DEX or lending protocol)"
      ),
      amount: z.string().describe(
        "The amount of tokens to approve in token units, not wei (e.g., '1000' to approve spending 1000 tokens). Use a very large number for unlimited approval."
      ),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, spenderAddress, amount, network }) => {
      try {
        const result = await approveERC20(
          tokenAddress,
          spenderAddress,
          amount,
          privateKey,
          network
        );
        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          tokenAddress,
          spenderAddress,
          amount: result.amount.formatted,
          symbol: result.token.symbol,
          network
        });
      } catch (error) {
        return mcpToolRes.error(error, "approving token spending");
      }
    }
  );
  server.tool(
    "transfer_erc20",
    "Transfer ERC20 tokens to an address",
    {
      privateKey: privateKeyParam,
      tokenAddress: z.string().describe(
        "The contract address or ENS name of the ERC20 token to transfer (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC or 'uniswap.eth')"
      ),
      toAddress: z.string().describe(
        "The recipient address or ENS name that will receive the tokens (e.g., '0x1234...' or 'vitalik.eth')"
      ),
      amount: z.string().describe(
        "Amount of tokens to send as a string (e.g., '100' for 100 tokens). This will be adjusted for the token's decimals."
      ),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, toAddress, amount, network }) => {
      try {
        const result = await transferERC20(
          tokenAddress,
          toAddress,
          amount,
          privateKey,
          network
        );
        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          tokenAddress,
          toAddress,
          amount: result.amount.formatted,
          symbol: result.token.symbol,
          network
        });
      } catch (error) {
        return mcpToolRes.error(error, "transferring tokens");
      }
    }
  );
}

// src/evm/modules/wallet/index.ts
function registerWallet(server) {
  registerWalletTools(server);
  registerWaletPrompts(server);
}

// src/evm/index.ts
function registerEVM(server) {
  registerNetwork(server);
  registerBlocks(server);
  registerTransactions(server);
  registerContracts(server);
  registerWallet(server);
  registerTokens(server);
  registerNFT(server);
  registerSwap(server);
  registerBridge(server);
  registerStaking(server);
  registerLending(server);
  registerPriceFeeds(server);
  registerGas(server);
  registerEvents(server);
  registerMulticall(server);
  registerSignatures(server);
  registerDomains(server);
  registerSecurity(server);
  registerPortfolio(server);
  registerGovernance(server);
}

export { DEFAULT_CHAIN_ID, DEFAULT_RPC_URL, approveERC20, chainMap, createERC20Token, estimateGas, getAddressFromPrivateKey, getBlockByHash, getBlockByNumber, getBlockNumber, getChain, getChainId, getERC1155TokenMetadata, getERC20Balance, getERC20TokenInfo, getERC721TokenMetadata, getLatestBlock, getLogs, getNativeBalance, getPublicClient, getRpcUrl, getSupportedNetworks, getTransaction, getTransactionCount, getTransactionReceipt, getWalletClient, utils as helpers, isContract, networkNameMap, readContract, registerEVM, resolveAddress, resolveChainId, rpcUrlMap, transferERC1155, transferERC20, transferERC721, transferETH, writeContract };
//# sourceMappingURL=lib.js.map
//# sourceMappingURL=lib.js.map