export interface ButtonConfig {
  id: number;
  address: string;
  value: string;
  data?: string; // Optional: raw transaction data
  gas?: string;
  color: string;
  description?: string;
  // Optional: for ABI-based transactions
  abi?: any;
  functionName?: string;
  args?: any[];
}

export interface Settings {
  [key: string]: ButtonConfig;
}

export interface VisibleButtons {
  [key: string]: boolean;
}