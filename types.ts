// FIX: Import React to make React types available for the JSX IntrinsicElements declaration.
import React from 'react';
import type { Abi } from 'viem';

// FIX: Add global declarations for custom JSX elements and Vite environment variables.
declare global {
  // FIX: The type for the <w3m-button> web component is not being picked up automatically from the library.
  // Manually declaring it here to resolve the 'Property 'w3m-button' does not exist on type 'JSX.IntrinsicElements'' error.
  // The new declaration includes properties specific to w3m-button to be compatible with library types,
  // and extends standard HTML attributes for things like `className`, `style`, etc.
  namespace JSX {
    interface IntrinsicElements {
      'w3m-button': React.HTMLAttributes<HTMLElement> & {
        label?: string;
        size?: 'sm' | 'md' | 'lg';
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