import { GraphQLClient, gql } from 'graphql-request';

const SUBGRAPH_URLS: Record<string, string> = {
  'base': 'https://api.studio.thegraph.com/query/1716033/privacy-pool-base/v0.0.2',
  'polygon': 'https://api.studio.thegraph.com/query/1716033/privacy-pool-polygon/v0.0.1',
};

export interface Commitment {
  id: string; // commitment hash
  leafIndex: string;
  amount: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
  transactionIndex: string;
  isSpent: boolean;
}

export interface PoolStats {
  totalDeposits: string;
  totalPayments: string;
  totalCommitments: string;
  totalSpentCommitments: string;
  currentRootIndex: string;
  latestRoot: string | null;
}

const GET_ALL_COMMITMENTS = gql`
  query GetAllCommitments($first: Int!, $skip: Int!) {
    commitments(
      first: $first
      skip: $skip
      orderBy: blockNumber
      orderDirection: asc
    ) {
      id
      leafIndex
      amount
      blockNumber
      blockTimestamp
      transactionHash
      transactionIndex
      isSpent
    }
  }
`;

const GET_POOL_STATS = gql`
  query GetPoolStats {
    poolStats(id: "1") {
      totalDeposits
      totalPayments
      totalCommitments
      totalSpentCommitments
      currentRootIndex
      latestRoot
    }
  }
`;

export class SubgraphClient {
  private client: GraphQLClient;
  private chainName: string;

  constructor(chainName: string) {
    const url = SUBGRAPH_URLS[chainName.toLowerCase()];
    if (!url) {
      throw new Error(`No subgraph URL for chain: ${chainName}`);
    }
    this.client = new GraphQLClient(url);
    this.chainName = chainName;
  }

  async getAllCommitments(): Promise<Commitment[]> {
    console.log(`Fetching commitments from subgraph for ${this.chainName}...`);
    const allCommitments: Commitment[] = [];
    const batchSize = 1000;
    let skip = 0;

    while (true) {
      const data = await this.client.request<{ commitments: Commitment[] }>(
        GET_ALL_COMMITMENTS,
        { first: batchSize, skip }
      );

      allCommitments.push(...data.commitments);

      if (data.commitments.length < batchSize) {
        break;
      }

      skip += batchSize;
    }

    console.log(`Found ${allCommitments.length} commitments from subgraph`);
    return allCommitments;
  }

  async getPoolStats(): Promise<PoolStats | null> {
    const data = await this.client.request<{ poolStats: PoolStats | null }>(
      GET_POOL_STATS
    );
    return data.poolStats;
  }
}
