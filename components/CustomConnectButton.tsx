import React, { useState, useRef, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { WalletIcon, DisconnectIcon } from './icons';

export const CustomConnectButton: React.FC = () => {
    const { address, chainId, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { openConnectModal } = useConnectModal();
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isConnected || !address) {
        return (
            <button
                onClick={openConnectModal}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
            >
                <WalletIcon className="w-5 h-5 mr-2" />
                Connect Wallet
            </button>
        );
    }

    const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center space-x-2 sm:space-x-3 bg-gray-700 text-white pl-3 pr-2 sm:px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200"
            >
                <div className="text-sm text-right">
                    <span className="font-mono">{formattedAddress}</span>
                    {/* Hide Chain ID on small screens to save space */}
                    <span className="hidden sm:block text-xs text-gray-400">Chain: {chainId}</span>
                </div>
                <WalletIcon className="w-6 h-6 flex-shrink-0" />
            </button>
            {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg py-1 z-20 border border-gray-700">
                    <button
                        onClick={() => {
                            disconnect();
                            setDropdownOpen(false);
                        }}
                        className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                    >
                        <DisconnectIcon className="w-5 h-5 mr-3" />
                        Disconnect
                    </button>
                </div>
            )}
        </div>
    );
};
