import type { Abi } from 'viem';

// FIX: Add global declarations for custom JSX elements and Vite environment variables.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // FIX: Removed the 'w3m-button' type declaration. It was conflicting with the type provided by the
      // '@web3modal/wagmi/react' package, causing a "Subsequent property declarations must have the same type" error.
      // The library's built-in type is sufficient for the component's usage within this application.
    }
  }

  // Add type declarations for Vite environment variables.
  interface ImportMetaEnv {
    readonly VITE_PROJECT_ID: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Defines a read call that can be embedded directly into the `args` array.
export interface ReadCall {
  '$read': {
    // Optional: The address of the contract to read from.
    // If not provided, it defaults to the parent button's address.
    address?: string;
    abi: Abi | readonly unknown[];
    functionName: string;
    args: any[];
  }
}

export interface ButtonConfig {
  id: number | string;
  address: string;
  value: string;
  data?: string; // Optional: raw transaction data
  gas?: string;
  color: string;
  description?: string;
  // Optional: for ABI-based transactions
  abi?: Abi | readonly unknown[];
  functionName?: string;
  // Arguments can be simple values or complex nested objects.
  args?: any[];
  readOnly?: boolean;

  // For chained actions
  type?: 'single' | 'chained';
  steps?: ButtonConfig[];

  // Optional: for adding a new network
  chainName?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
  blockExplorerUrls?: string[];
}

export interface Settings {
  [key:string]: ButtonConfig;
}

export interface VisibleButtons {
  [key: string]: boolean;
}

export interface ProfileVisibility {
  [profileName: string]: VisibleButtons;
}