export async function fetchWalletBalances(walletAddress: string) {
  try {
    const response = await fetch(`/api/balances?address=${walletAddress}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      eth: data.eth,
      usdc: data.usdc
    };
  } catch (error) {
    console.error('Failed to fetch balances:', error);
    return {
      eth: 'Error',
      usdc: 'Error'
    };
  }
}

