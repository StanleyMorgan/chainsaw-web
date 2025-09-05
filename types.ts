// A user-friendly definition for a custom chain, compatible with viem's Chain type.
export interface ChainDefinition {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: { http: string[] };
    public?: { http: string[] };
    [key: string]: any;
  };
  blockExplorers?: {
    default: { name: string; url: string };
    [key: string]: any;
  };
}


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
  // Optional: for defining a custom network
  chain?: ChainDefinition;
}

export interface Settings {
  [key: string]: ButtonConfig;
}

export interface VisibleButtons {
  [key: string]: boolean;
}