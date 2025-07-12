// Configuration for blockchain transactions
export interface TransactionConfig {
  // Network configuration
  chainId: number;
  chainName: string;
  
  // Transaction parameters
  to: string; // Contract or recipient address
  value: string; // Amount in wei (hex format)
  data: string; // Transaction data (hex format)
  
  // Gas settings
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

// Default transaction configuration for Ethereum mainnet
export const DEFAULT_TRANSACTION_CONFIG: TransactionConfig = {
  chainId: 1,
  chainName: 'Ethereum Mainnet',
  to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', // Example contract address
  value: '0x0', // 0 ETH
  data: '0x', // No data
  gasLimit: '0x186A0', // 100,000 gas
  maxFeePerGas: '0x59682F00', // 1.5 Gwei
  maxPriorityFeePerGas: '0x59682F00', // 1.5 Gwei
};

// Configuration for different networks
export const NETWORK_CONFIGS: Record<number, TransactionConfig> = {
  1: { // Ethereum Mainnet
    ...DEFAULT_TRANSACTION_CONFIG,
    chainName: 'Ethereum Mainnet',
  },
  56: { // BSC
    ...DEFAULT_TRANSACTION_CONFIG,
    chainId: 56,
    chainName: 'Binance Smart Chain',
    gasLimit: '0x186A0',
    maxFeePerGas: '0x3B9ACA00', // 1 Gwei
    maxPriorityFeePerGas: '0x3B9ACA00',
  },
  137: { // Polygon
    ...DEFAULT_TRANSACTION_CONFIG,
    chainId: 137,
    chainName: 'Polygon',
    gasLimit: '0x186A0',
    maxFeePerGas: '0x59682F00', // 1.5 Gwei
    maxPriorityFeePerGas: '0x59682F00',
  },
  88882: { // Chiliz Chain
    chainId: 88882,
    chainName: 'Chiliz Chain',
    to: '0xbCE7457679913BD81Da8ba3106dF11191141E12D',
    value: '0x' + (1e18).toString(16), // 1 CHZ (18 décimales)
    data: '0x',
    gasLimit: '0x5208', // 21000
    maxFeePerGas: undefined,
    maxPriorityFeePerGas: undefined,
  },
};

// Function to get transaction config for a specific network
export function getTransactionConfig(chainId: number): TransactionConfig {
  return NETWORK_CONFIGS[chainId] || DEFAULT_TRANSACTION_CONFIG;
}

// Function to create a transaction object for WalletConnect
export function createTransaction(chainId: number, customConfig?: Partial<TransactionConfig>) {
  const config = { ...getTransactionConfig(chainId), ...customConfig };
  
  return {
    to: config.to,
    value: config.value,
    data: config.data,
    chainId: config.chainId,
    ...(config.gasLimit && { gas: config.gasLimit }),
    ...(config.maxFeePerGas && { maxFeePerGas: config.maxFeePerGas }),
    ...(config.maxPriorityFeePerGas && { maxPriorityFeePerGas: config.maxPriorityFeePerGas }),
  };
}

// Function to validate transaction parameters
export function validateTransaction(tx: any): boolean {
  return (
    tx.to &&
    tx.value !== undefined &&
    tx.data !== undefined &&
    tx.chainId !== undefined
  );
} 