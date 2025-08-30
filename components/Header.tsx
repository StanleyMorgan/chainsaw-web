import React from 'react';
import { useAccount } from 'wagmi';
import { HomeIcon, CogIcon } from './icons';
import { CustomConnectButton } from './CustomConnectButton';

interface HeaderProps {
  currentView: 'main' | 'settings';
  setView: (view: 'main' | 'settings') => void;
}

const NavButton: React.FC<{
  label: string;
  children: React.ReactNode;
  isCurrent: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, children, isCurrent, onClick, disabled }) => (
  <div title={disabled ? "Connect your wallet to access settings" : ""}>
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center w-full px-4 py-2 rounded-md transition-colors duration-200 ${
        isCurrent
          ? 'bg-blue-600 text-white'
          : 'text-gray-300'
      } ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-gray-700 hover:text-white'
      }`}
      aria-label={label}
    >
      {children}
      <span className="ml-2 hidden sm:inline">{label}</span>
    </button>
  </div>
);


export const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const { isConnected } = useAccount();

  return (
    <header className="bg-gray-800 shadow-lg p-4 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center">
        <img src="icons/icon48.png" alt="Chainsaw Logo" className="h-8 w-8 mr-3" />
        <h1 className="text-xl md:text-2xl font-bold text-white mr-4">Chainsaw</h1>
        <nav className="flex space-x-2">
          <NavButton label="Main" isCurrent={currentView === 'main'} onClick={() => setView('main')}>
            <HomeIcon />
          </NavButton>
          <NavButton label="Settings" isCurrent={currentView === 'settings'} onClick={() => setView('settings')} disabled={!isConnected}>
            <CogIcon />
          </NavButton>
        </nav>
      </div>

      <div>
        <CustomConnectButton />
      </div>
    </header>
  );
};