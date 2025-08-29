
import React, { useState, useRef } from 'react';
import type { Settings, VisibleButtons, ButtonConfig } from '../types';
import type { NotificationData } from './Notification';
import { useAccount, useSendTransaction } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AddButtonModal } from './AddButtonModal';
import { PlusIcon } from './icons';

interface MainViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  visibleButtons: VisibleButtons;
  setVisibleButtons: (visibleButtons: VisibleButtons) => void;
  buttonOrder: string[];
  setButtonOrder: (order: string[]) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
}

const ActionButton: React.FC<{
    buttonKey: string;
    config: ButtonConfig;
    onClick: () => void;
}> = ({ buttonKey, config, onClick }) => {
    return (
        <button
            onClick={onClick}
            style={{ backgroundColor: config.color, color: '#FFFFFF' }}
            className="w-full text-white font-bold py-4 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200 flex items-center justify-center"
        >
            <span className="capitalize">{buttonKey}</span>
        </button>
    );
};

export const MainView: React.FC<MainViewProps> = ({ settings, setSettings, visibleButtons, setVisibleButtons, buttonOrder, setButtonOrder, showNotification }) => {
  const { address, chainId, isConnected, connector } = useAccount();
  const { sendTransaction } = useSendTransaction();
  const [hoveredDescription, setHoveredDescription] = useState<string>('Hover over a button to see its description.');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const draggedItemKey = useRef<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, key: string) => {
    draggedItemKey.current = key;
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // This is necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropKey: string) => {
    e.preventDefault();
    const draggedKey = draggedItemKey.current;

    if (draggedKey && draggedKey !== dropKey) {
      const currentOrder = [...buttonOrder];
      const draggedIndex = currentOrder.indexOf(draggedKey);
      const dropIndex = currentOrder.indexOf(dropKey);
      
      const [removed] = currentOrder.splice(draggedIndex, 1);
      currentOrder.splice(dropIndex, 0, removed);
      
      setButtonOrder(currentOrder);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    draggedItemKey.current = null;
  };


  const handleSaveButton = (key: string, config: ButtonConfig) => {
    const isNewButton = !(key in settings);
    const newSettings = { ...settings, [key]: config };
    setSettings(newSettings);
    setVisibleButtons({ ...visibleButtons, [key]: true });
    if (isNewButton) {
      setButtonOrder([...buttonOrder, key]);
    }
    showNotification(`Button "${key}" saved successfully!`, 'success');
  };

  const handleTransaction = async (config: ButtonConfig) => {
    if (!isConnected || !address) {
        showNotification('Please connect your wallet first.', 'info');
        return;
    }

    const executeTransaction = () => {
        sendTransaction({
            to: config.address as `0x${string}`,
            value: config.value ? BigInt(config.value) : undefined,
            data: config.data as `0x${string}`,
            gas: config.gas ? BigInt(config.gas) : undefined,
        }, {
            onSuccess: (hash) => {
                showNotification(`Transaction sent! Hash: ${hash.slice(0,10)}...`, 'success');
            },
            onError: (error) => {
                const message = error.message.includes('User rejected the request') 
                    ? 'Transaction rejected.' 
                    : `Transaction failed: ${error.message.split(/[\(.]/)[0]}`;

                showNotification(message, message.includes('rejected') ? 'info' : 'error');
                console.error("Transaction Error:", error);
            }
        });
    }
    
    if (chainId !== config.id) {
        if (!connector) {
            showNotification('Wallet connector not found.', 'error');
            return;
        }

        try {
            const provider = await connector.getProvider();
            // Fix: Cast provider to `any` because `connector.getProvider()` returns `unknown` for type safety.
            await (provider as any).request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${config.id.toString(16)}` }],
            });
            showNotification('Network switched. Please click the button again to send.', 'success');
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                showNotification(`This network (Chain ID: ${config.id}) is not added to your wallet. Please add it manually.`, 'error');
            } else {
                const message = switchError.message?.includes('User rejected the request')
                    ? 'Request to switch network rejected.'
                    : `Failed to switch network: ${switchError.message?.split(/[\(.]/)[0]}`;
                showNotification(message, 'error');
            }
            console.error("Switch Network Error:", switchError);
        }
    } else {
        executeTransaction();
    }
  };

  const orderedVisibleKeys = buttonOrder.filter(key => visibleButtons[key] !== false);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-800 rounded-lg max-w-md mx-auto mt-10">
        <h2 className="text-2xl font-bold mb-4">Welcome to Chainsaw</h2>
        <p className="text-gray-400 mb-6">Connect your wallet to get started and interact with your pre-configured contracts.</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div>
      <AddButtonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveButton}
        showNotification={showNotification}
      />

      {orderedVisibleKeys.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column */}
          <div className="lg:w-1/3 lg:max-w-sm flex flex-col gap-4 order-last lg:order-first">
            {/* Description Panel */}
            <div className="bg-gray-800 p-6 rounded-lg self-start lg:sticky lg:top-24 w-full">
              <h3 className="text-lg font-bold mb-4 text-gray-200 border-b border-gray-700 pb-2">
                Action Description
              </h3>
              <div className="h-48 overflow-y-auto text-gray-300 font-mono text-sm">
                  <p className="whitespace-pre-wrap">{hoveredDescription}</p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 font-semibold flex items-center justify-center"
              aria-label="Add New Button"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Button
            </button>
          </div>


          {/* Buttons Grid */}
          <div 
            className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 order-first lg:order-last"
            onMouseLeave={() => setHoveredDescription('Hover over a button to see its description.')}
          >
            {orderedVisibleKeys.map((key) => {
              const config = settings[key];
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, key)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => setHoveredDescription(config.description || 'No description available for this action.')}
                  className="cursor-move transition-opacity duration-200"
                >
                  <ActionButton
                    buttonKey={key}
                    config={config}
                    onClick={() => handleTransaction(config)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-gray-800 rounded-lg mt-10 max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-2">No Buttons Configured</h2>
          <p className="text-gray-400 mb-6">Go to the Settings page to configure your action buttons, or click below to add your first one.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors duration-200 font-semibold"
            aria-label="Add New Button"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Add First Button
          </button>
        </div>
      )}
    </div>
  );
};