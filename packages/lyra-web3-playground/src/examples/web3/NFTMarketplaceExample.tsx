/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Small steps lead to big achievements 🏔️
 */

import { useState } from 'react';
import { Image, Upload, Sparkles, ExternalLink } from 'lucide-react';

interface NFT {
  id: number;
  name: string;
  description: string;
  image: string;
  attributes: { trait_type: string; value: string }[];
  owner: string;
  price?: number;
  forSale: boolean;
}

export default function NFTMarketplaceExample() {
  const [nfts, setNfts] = useState<NFT[]>([
    {
      id: 1,
      name: 'Cosmic Cat #001',
      description: 'A rare cosmic cat from the outer galaxy',
      image: '🐱',
      attributes: [
        { trait_type: 'Background', value: 'Cosmic Purple' },
        { trait_type: 'Rarity', value: 'Legendary' },
      ],
      owner: '0x1234...5678',
      price: 2.5,
      forSale: true,
    },
    {
      id: 2,
      name: 'Pixel Punk #042',
      description: 'A pixelated punk with attitude',
      image: '👾',
      attributes: [
        { trait_type: 'Background', value: 'Blue' },
        { trait_type: 'Rarity', value: 'Common' },
      ],
      owner: '0xabcd...efgh',
      price: 0.5,
      forSale: true,
    },
    {
      id: 3,
      name: 'Robot #123',
      description: 'A futuristic robot from 2077',
      image: '🤖',
      attributes: [
        { trait_type: 'Background', value: 'Cyber Red' },
        { trait_type: 'Rarity', value: 'Rare' },
      ],
      owner: '0x9876...4321',
      price: 1.8,
      forSale: true,
    },
  ]);

  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [userAddress] = useState('0x9999...0000');
  const [filter, setFilter] = useState<'all' | 'for-sale' | 'my-nfts'>('all');

  const handleBuyNFT = (nft: NFT) => {
    if (!nft.forSale || !nft.price) return;
    
    setNfts(nfts.map(n => 
      n.id === nft.id 
        ? { ...n, owner: userAddress, forSale: false, price: undefined }
        : n
    ));
    setSelectedNFT(null);
    alert(`Successfully purchased ${nft.name} for ${nft.price} ETH!`);
  };

  const handleListForSale = (nftId: number, price: number) => {
    setNfts(nfts.map(n =>
      n.id === nftId
        ? { ...n, forSale: true, price }
        : n
    ));
  };

  const handleUnlist = (nftId: number) => {
    setNfts(nfts.map(n =>
      n.id === nftId
        ? { ...n, forSale: false, price: undefined }
        : n
    ));
  };

  const filteredNFTs = nfts.filter(nft => {
    if (filter === 'for-sale') return nft.forSale;
    if (filter === 'my-nfts') return nft.owner === userAddress;
    return true;
  });

  const myNFTsCount = nfts.filter(n => n.owner === userAddress).length;
  const totalValue = nfts
    .filter(n => n.owner === userAddress && n.forSale && n.price)
    .reduce((sum, n) => sum + (n.price || 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">NFT Marketplace</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Buy, sell, and trade unique digital collectibles
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">My NFTs</span>
            <Image className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">{myNFTsCount}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Listed Value</span>
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{totalValue.toFixed(2)} ETH</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Listings</span>
            <Upload className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold">{nfts.filter(n => n.forSale).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          All NFTs
        </button>
        <button
          onClick={() => setFilter('for-sale')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'for-sale'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          For Sale
        </button>
        <button
          onClick={() => setFilter('my-nfts')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'my-nfts'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          My NFTs
        </button>
      </div>

      {/* NFT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {filteredNFTs.map(nft => (
          <div
            key={nft.id}
            className="card cursor-pointer hover:border-primary-500 transition-colors"
            onClick={() => setSelectedNFT(nft)}
          >
            <div className="text-6xl text-center mb-4">{nft.image}</div>
            <h3 className="font-bold text-lg mb-1">{nft.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
              {nft.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div>
                {nft.forSale && nft.price && (
                  <div>
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="font-bold">{nft.price} ETH</p>
                  </div>
                )}
                {!nft.forSale && (
                  <p className="text-sm text-gray-500">Not for sale</p>
                )}
              </div>
              {nft.owner === userAddress && (
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                  Owned
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* NFT Detail Modal */}
      {selectedNFT && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedNFT(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image */}
              <div>
                <div className="text-8xl text-center mb-4">{selectedNFT.image}</div>
                
                {/* Attributes */}
                <div className="space-y-2">
                  <h3 className="font-bold text-sm">Attributes</h3>
                  {selectedNFT.attributes.map((attr, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-gray-600 dark:text-gray-400">{attr.trait_type}</span>
                      <span className="font-semibold">{attr.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedNFT.name}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {selectedNFT.description}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Token ID</span>
                    <span className="font-semibold">#{selectedNFT.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Owner</span>
                    <span className="font-mono text-xs">
                      {selectedNFT.owner === userAddress ? 'You' : selectedNFT.owner}
                    </span>
                  </div>
                  {selectedNFT.forSale && selectedNFT.price && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Price</span>
                      <span className="text-xl font-bold">{selectedNFT.price} ETH</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {selectedNFT.owner !== userAddress && selectedNFT.forSale && (
                    <button
                      onClick={() => handleBuyNFT(selectedNFT)}
                      className="w-full btn-primary"
                    >
                      Buy Now for {selectedNFT.price} ETH
                    </button>
                  )}

                  {selectedNFT.owner === userAddress && !selectedNFT.forSale && (
                    <button
                      onClick={() => {
                        const price = prompt('Enter listing price in ETH:');
                        if (price && parseFloat(price) > 0) {
                          handleListForSale(selectedNFT.id, parseFloat(price));
                          setSelectedNFT(null);
                        }
                      }}
                      className="w-full btn-primary"
                    >
                      List for Sale
                    </button>
                  )}

                  {selectedNFT.owner === userAddress && selectedNFT.forSale && (
                    <button
                      onClick={() => {
                        handleUnlist(selectedNFT.id);
                        setSelectedNFT(null);
                      }}
                      className="w-full btn-secondary"
                    >
                      Remove Listing
                    </button>
                  )}

                  <button
                    onClick={() => window.open(`https://etherscan.io/token/0x.../${selectedNFT.id}`, '_blank')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Etherscan
                  </button>

                  <button
                    onClick={() => setSelectedNFT(null)}
                    className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This is a simulation of NFT marketplaces like OpenSea or Rarible. 
          In production, this would use ERC-721 smart contracts for NFT ownership and marketplace contracts for buying/selling.
        </p>
      </div>
    </div>
  );
}
