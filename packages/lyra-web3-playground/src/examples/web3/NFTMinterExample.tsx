/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Passion fuels progress ⚡
 */

import { useState } from 'react';
import { Image, Upload, CheckCircle, AlertCircle, ExternalLink, Loader } from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';
import { generateMockIPFSHash, generateMockTxHash } from '@/utils/helpers';

interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface MintedNFT {
  id: number;
  name: string;
  description: string;
  image: string;
  attributes: NFTAttribute[];
  tokenId?: string;
  transactionHash?: string;
}

export default function NFTMinterExample() {
  const { isConnected, address } = useWalletStore();
  
  // Form state
  const [nftName, setNftName] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [attributes, setAttributes] = useState<NFTAttribute[]>([
    { trait_type: '', value: '' }
  ]);
  
  // Minting state
  const [isMinting, setIsMinting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mintedNFTs, setMintedNFTs] = useState<MintedNFT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index][field] = value;
    setAttributes(newAttributes);
  };

  const handleMintNFT = async () => {
    setError(null);
    setSuccess(null);

    // Validation
    if (!nftName.trim()) {
      setError('NFT name is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!imagePreview) {
      setError('Please upload an image');
      return;
    }

    setIsMinting(true);
    setIsUploading(true);

    try {
      // Simulate IPFS upload (in real implementation, use Pinata or IPFS client)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockImageHash = generateMockIPFSHash();
      setIsUploading(false);

      // Filter out empty attributes
      const validAttributes = attributes.filter(
        attr => attr.trait_type.trim() && attr.value.trim()
      );

      // Create metadata
      const metadata = {
        name: nftName,
        description: description,
        image: `ipfs://${mockImageHash}`,
        attributes: validAttributes,
      };

      // Simulate metadata upload to IPFS
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockMetadataHash = generateMockIPFSHash();

      // Simulate minting transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockTokenId = Math.floor(Math.random() * 10000).toString();
      const mockTxHash = generateMockTxHash();

      // Add to minted NFTs
      const newNFT: MintedNFT = {
        id: Date.now(),
        name: nftName,
        description: description,
        image: imagePreview,
        attributes: validAttributes,
        tokenId: mockTokenId,
        transactionHash: mockTxHash,
      };

      setMintedNFTs([newNFT, ...mintedNFTs]);
      setSuccess(`Successfully minted "${nftName}" as token #${mockTokenId}!`);

      // Reset form
      setNftName('');
      setDescription('');
      setImagePreview('');
      setAttributes([{ trait_type: '', value: '' }]);
    } catch (err: any) {
      console.error('Minting error:', err);
      setError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
      setIsUploading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">NFT Minter</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create and mint NFTs with IPFS storage and metadata
          </p>
        </div>

        <div className="card text-center py-16">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-4">Wallet Not Connected</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Please connect your wallet to mint NFTs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">NFT Minter</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and mint NFTs with IPFS storage and metadata
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Minting Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Create NFT</h2>

            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Upload Image *</label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                {imagePreview ? (
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <button
                      onClick={() => setImagePreview('')}
                      className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-md text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <label className="cursor-pointer">
                      <span className="text-primary-600 hover:text-primary-700">
                        Click to upload
                      </span>
                      <span className="text-gray-500"> or drag and drop</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-sm text-gray-500 mt-2">PNG, JPG, GIF up to 5MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* NFT Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">NFT Name *</label>
                <input
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value)}
                  placeholder="e.g., Cosmic Cat #001"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your NFT..."
                  rows={4}
                  className="input w-full"
                />
              </div>

              {/* Attributes */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Attributes (Optional)</label>
                  <button
                    onClick={addAttribute}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + Add Attribute
                  </button>
                </div>
                <div className="space-y-2">
                  {attributes.map((attr, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={attr.trait_type}
                        onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                        placeholder="Trait Type (e.g., Background)"
                        className="input flex-1"
                      />
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                        placeholder="Value (e.g., Blue)"
                        className="input flex-1"
                      />
                      {attributes.length > 1 && (
                        <button
                          onClick={() => removeAttribute(index)}
                          className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}

            {success && (
              <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="text-green-600 dark:text-green-400">{success}</span>
              </div>
            )}

            {/* Mint Button */}
            <button
              onClick={handleMintNFT}
              disabled={isMinting}
              className="btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMinting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  {isUploading ? 'Uploading to IPFS...' : 'Minting...'}
                </>
              ) : (
                <>
                  <Image className="w-4 h-4 mr-2" />
                  Mint NFT
                </>
              )}
            </button>
          </div>

          {/* Info Card */}
          <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
              ℹ️ Demo Mode
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              This is a demonstration. In production, your image and metadata would be uploaded to IPFS,
              and an ERC-721 token would be minted on-chain. The demo simulates these processes.
            </p>
          </div>
        </div>

        {/* Minted NFTs */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Your Minted NFTs</h2>
            
            {mintedNFTs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No NFTs minted yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mintedNFTs.map((nft) => (
                  <div key={nft.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <img 
                      src={nft.image} 
                      alt={nft.name}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                    <h3 className="font-semibold mb-1">{nft.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {nft.description}
                    </p>
                    {nft.tokenId && (
                      <p className="text-xs text-gray-500 mb-2">
                        Token ID: #{nft.tokenId}
                      </p>
                    )}
                    {nft.attributes.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium mb-1">Attributes:</p>
                        <div className="flex flex-wrap gap-1">
                          {nft.attributes.map((attr, idx) => (
                            <span 
                              key={idx}
                              className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded"
                            >
                              {attr.trait_type}: {attr.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {nft.transactionHash && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${nft.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center"
                      >
                        View on Etherscan
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="card">
            <h3 className="font-semibold mb-3">Minting Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Minted:</span>
                <span className="font-semibold">{mintedNFTs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Your Address:</span>
                <span className="font-mono text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
