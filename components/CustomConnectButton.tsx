
import React, { useState, useRef, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { PowerIcon, DisconnectIcon, ChevronDownIcon } from './icons';

export const CustomConnectButton: React.FC = () => {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { open } = useAppKit();
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, []);

    if (!isConnected || !address) {
        return (
            <button
                onClick={() => open()}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
                aria-label="Connect Wallet"
            >
                <PowerIcon className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">Connect Wallet</span>
            </button>
        );
    }

    const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    const handleDisconnect = () => {
        disconnect();
        setDropdownOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center justify-center bg-gray-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
                aria-label="Wallet options"
            >
                <PowerIcon className="w-5 h-5 block sm:hidden" />
                <span className="hidden sm:inline font-mono text-sm">{formattedAddress}</span>
                <ChevronDownIcon className="w-5 h-5 ml-2 text-gray-400 hidden sm:inline-flex" />
            </button>
            {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg py-1 z-20 border border-gray-700">
                    <button
                        onClick={handleDisconnect}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            handleDisconnect();
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