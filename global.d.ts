// FIX: Manually define Vite client types to resolve errors with `import.meta.env`
// and the `vite/client` type reference.
interface ImportMetaEnv {
  readonly VITE_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
