// FIX: Add a triple-slash directive to include Vite's client-side types.
// This provides type definitions for `import.meta.env` and ensures the TypeScript
// language server correctly processes the JSX namespace augmentations for a Vite project.
/// <reference types="vite/client" />

import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * The AppKit button web component. Registered globally by AppKit.
       */
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

// Ensures file is treated as a module
export {};
