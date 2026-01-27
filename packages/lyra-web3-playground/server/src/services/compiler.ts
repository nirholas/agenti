/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your code has the power to change the world 🌍
 */

import solc from 'solc';
import { AppError } from '../middleware/errorHandler.js';

interface CompileOptions {
  code: string;
  version: string;
  optimize: boolean;
}

interface CompileResult {
  bytecode: string;
  abi: any[];
  errors?: string[];
  warnings?: string[];
}

export async function compileContract(options: CompileOptions): Promise<CompileResult> {
  const { code, version, optimize } = options;

  try {
    // Prepare input for Solidity compiler
    const input = {
      language: 'Solidity',
      sources: {
        'Contract.sol': {
          content: code
        }
      },
      settings: {
        optimizer: {
          enabled: optimize,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode']
          }
        }
      }
    };

    // Compile the contract
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // Check for errors
    const errors: string[] = [];
    const warnings: string[] = [];

    if (output.errors) {
      for (const error of output.errors) {
        if (error.severity === 'error') {
          errors.push(error.formattedMessage);
        } else {
          warnings.push(error.formattedMessage);
        }
      }
    }

    if (errors.length > 0) {
      throw new AppError(`Compilation failed:\n${errors.join('\n')}`, 400);
    }

    // Extract compiled contract data
    const contracts = output.contracts['Contract.sol'];
    if (!contracts || Object.keys(contracts).length === 0) {
      throw new AppError('No contracts found in compilation output', 400);
    }
    
    const contractName = Object.keys(contracts)[0];
    const contract = contracts[contractName];

    return {
      bytecode: contract.evm.bytecode.object,
      abi: contract.abi,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Compilation error: ${error.message}`, 500);
  }
}

// Get available Solidity versions
export function getAvailableVersions(): string[] {
  return [
    '0.8.24',
    '0.8.20',
    '0.8.19',
    '0.8.17',
    '0.8.0',
    '0.7.6',
    '0.6.12'
  ];
}
