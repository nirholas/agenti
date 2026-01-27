/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Making the digital world a better place 🌐
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NFTMinterExample from '../src/examples/web3/NFTMinterExample';
import SmartContractExample from '../src/examples/web3/SmartContractExample';

// Mock the wallet store
vi.mock('../src/stores/walletStore', () => ({
  useWalletStore: vi.fn(() => ({
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    isConnected: true,
    chainId: 11155111,
    disconnect: vi.fn(),
    setWallet: vi.fn(),
  })),
}));

// Mock the theme store
vi.mock('../src/stores/themeStore', () => ({
  useThemeStore: vi.fn(() => ({
    mode: 'light',
    setMode: vi.fn(),
  })),
}));

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor">Monaco Editor Mock</div>,
}));

describe('NFT Minter Example', () => {
  it('should render the NFT Minter component', () => {
    render(
      <BrowserRouter>
        <NFTMinterExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText('NFT Minter')).toBeInTheDocument();
    expect(screen.getByText(/Create and mint NFTs/i)).toBeInTheDocument();
  });

  it('should display form fields when connected', () => {
    render(
      <BrowserRouter>
        <NFTMinterExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Create NFT')).toBeInTheDocument();
    expect(screen.getByText('Upload Image *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g., Cosmic Cat/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe your NFT/i)).toBeInTheDocument();
  });

  it('should display minted NFTs section', () => {
    render(
      <BrowserRouter>
        <NFTMinterExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Your Minted NFTs')).toBeInTheDocument();
    expect(screen.getByText('No NFTs minted yet')).toBeInTheDocument();
  });

  it('should display demo mode notice', () => {
    render(
      <BrowserRouter>
        <NFTMinterExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Demo Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/This is a demonstration/i)).toBeInTheDocument();
  });
});

describe('Smart Contract Deployer Example', () => {
  it('should render the Smart Contract Deployer component', () => {
    render(
      <BrowserRouter>
        <SmartContractExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Smart Contract Deployer')).toBeInTheDocument();
    expect(screen.getByText(/Write, compile, and deploy/i)).toBeInTheDocument();
  });

  it('should display contract templates', () => {
    render(
      <BrowserRouter>
        <SmartContractExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Simple Storage')).toBeInTheDocument();
    expect(screen.getByText('ERC20 Token')).toBeInTheDocument();
    expect(screen.getByText('Simple NFT')).toBeInTheDocument();
  });

  it('should display the Monaco editor', () => {
    render(
      <BrowserRouter>
        <SmartContractExample />
      </BrowserRouter>
    );
    
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('should display compile and deploy buttons', () => {
    render(
      <BrowserRouter>
        <SmartContractExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Compile Contract/i)).toBeInTheDocument();
    expect(screen.getByText(/Deploy to/i)).toBeInTheDocument();
  });

  it('should display network information', () => {
    render(
      <BrowserRouter>
        <SmartContractExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Network Info')).toBeInTheDocument();
    expect(screen.getByText('Network:')).toBeInTheDocument();
    expect(screen.getByText('Chain ID:')).toBeInTheDocument();
  });

  it('should display deployed contracts section', () => {
    render(
      <BrowserRouter>
        <SmartContractExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Deployed Contracts')).toBeInTheDocument();
    expect(screen.getByText('No contracts deployed yet')).toBeInTheDocument();
  });

  it('should display demo mode notice', () => {
    render(
      <BrowserRouter>
        <SmartContractExample />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Demo Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/This is a demonstration/i)).toBeInTheDocument();
  });
});
