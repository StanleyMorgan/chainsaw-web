import type { Abi } from 'viem';

// FIX: Add global declarations for custom JSX elements and Vite environment variables.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // FIX: Resolved a "Subsequent property declarations" error for `w3m-button`. The original type was missing
      // React's HTMLAttributes, which are likely part of the library's definition, causing a mismatch. The fix
      // re-adds HTMLAttributes but uses `Omit` to exclude the conflicting `size` property, ensuring type compatibility.
      'w3m-button': Omit<React.HTMLAttributes<HTMLElement>, 'size'> & {
        label?: string;
        size?: 'sm' | 'md';
        loadingLabel?: string;
        disabled?: boolean;
        balance?: 'show' | 'hide';
      };
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
