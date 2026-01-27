/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Great things are built by great people like you 👏
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  Box,
  Send,
  Eye,
  Loader,
  ExternalLink,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';


interface ContractInteractionProps {
  contract: {
    address: string;
    abi: any[];
    network: string;
    transactionHash: string;
  } | null;
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}

interface FunctionCall {
  name: string;
  inputs: any[];
  outputs: any[];
  stateMutability: string;
}

export default function ContractInteraction({ contract, onLog }: ContractInteractionProps) {
  const { provider } = useWalletStore();
  const [functions, setFunctions] = useState<FunctionCall[]>([]);
  const [expandedFunction, setExpandedFunction] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (contract?.abi) {
      const funcs = contract.abi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => ({
          name: item.name,
          inputs: item.inputs || [],
          outputs: item.outputs || [],
          stateMutability: item.stateMutability
        }));
      setFunctions(funcs);
    }
  }, [contract]);

  const handleInputChange = (funcName: string, inputName: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [`${funcName}_${inputName}`]: value
    }));
  };

  const handleFunctionCall = async (func: FunctionCall) => {
    if (!contract || !provider) {
      onLog('error', 'Contract or provider not available');
      return;
    }

    const key = func.name;
    setLoading(prev => ({ ...prev, [key]: true }));

    try {
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const contractInstance = new ethers.Contract(contract.address, contract.abi, signer);

      // Collect input values
      const args = func.inputs.map((input: any) => {
        const value = inputValues[`${func.name}_${input.name}`] || '';
        // Try to parse the value appropriately
        if (input.type.includes('uint') || input.type.includes('int')) {
          return value;
        }
        return value;
      });

      onLog('info', `Calling ${func.name}(${args.join(', ')})...`);

      let result: any;
      if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
        // Read-only call
        result = await contractInstance[func.name](...args);
        setResults(prev => ({ ...prev, [key]: result.toString() }));
        onLog('success', `${func.name} returned: ${result.toString()}`);
      } else {
        // Transaction
        const tx = await contractInstance[func.name](...args);
        onLog('info', `Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        setResults(prev => ({ 
          ...prev, 
          [key]: `Transaction confirmed in block ${receipt.blockNumber}` 
        }));
        onLog('success', `Transaction confirmed: ${tx.hash}`);
      }
    } catch (error: any) {
      onLog('error', `${func.name} failed: ${error.message}`);
      setResults(prev => ({ ...prev, [key]: `Error: ${error.message}` }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  if (!contract) {
    return (
      <div className="p-8 text-center">
        <Box className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          No Contract Deployed
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Compile and deploy a contract to interact with it
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Contract Info */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Deployed Contract
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Address:</span>
            <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
              {contract.address.substring(0, 10)}...{contract.address.substring(38)}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Network:</span>
            <span className="font-medium capitalize">{contract.network}</span>
          </div>
          <a
            href={`https://sepolia.etherscan.io/address/${contract.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:underline"
          >
            View on Explorer
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Functions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Contract Functions
        </h3>

        {functions.length === 0 ? (
          <p className="text-sm text-gray-500">No public functions found</p>
        ) : (
          functions.map((func) => {
            const key = func.name;
            const isExpanded = expandedFunction === key;
            const isReadOnly = func.stateMutability === 'view' || func.stateMutability === 'pure';

            return (
              <div
                key={key}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Function Header */}
                <button
                  onClick={() => setExpandedFunction(isExpanded ? null : key)}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {isReadOnly ? (
                      <Eye className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Send className="w-4 h-4 text-green-500" />
                    )}
                    <span className="font-mono text-sm font-semibold">
                      {func.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      isReadOnly 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {func.stateMutability}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {/* Function Body */}
                {isExpanded && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                    {/* Inputs */}
                    {func.inputs.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {func.inputs.map((input: any, idx: number) => (
                          <div key={idx}>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {input.name || `param${idx}`}
                              <span className="ml-2 text-gray-500">({input.type})</span>
                            </label>
                            <input
                              type="text"
                              value={inputValues[`${func.name}_${input.name}`] || ''}
                              onChange={(e) => handleInputChange(func.name, input.name, e.target.value)}
                              placeholder={`Enter ${input.type}`}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Call Button */}
                    <button
                      onClick={() => handleFunctionCall(func)}
                      disabled={loading[key]}
                      className={`w-full px-4 py-2 rounded font-medium text-sm flex items-center justify-center gap-2 ${
                        isReadOnly
                          ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white'
                          : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white'
                      }`}
                    >
                      {loading[key] ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          {isReadOnly ? 'Reading...' : 'Sending...'}
                        </>
                      ) : (
                        <>
                          {isReadOnly ? <Eye className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                          {isReadOnly ? 'Read' : 'Write'}
                        </>
                      )}
                    </button>

                    {/* Result */}
                    {results[key] && (
                      <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Result:
                        </div>
                        <div className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                          {results[key]}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
