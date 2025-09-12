import React, { useState, useRef, useCallback } from 'react';
import type { Settings, VisibleButtons, ButtonConfig, ReadCall } from '../types';
import type { NotificationData } from './Notification';
import { useAccount, useSendTransaction, useConfig } from 'wagmi';
// FIX: `addChain` is no longer exported from `wagmi/actions`. Replaced with `getWalletClient` to use the viem client's `addChain` method.
// FIX: `readContract`, `switchChain`, and `getWalletClient` are now imported from `@wagmi/core` in wagmi v2 to fix type errors.
import { readContract, switchChain, getWalletClient } from '@wagmi/core';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AddButtonModal } from './AddButtonModal';
import { InputModal } from './InputModal';
import { PlusIcon } from './icons';
import { encodeFunctionData, type Abi, type AbiFunction } from 'viem';

interface MainViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  visibleButtons: VisibleButtons;
  setVisibleButtons: (visibleButtons: VisibleButtons) => void;
  buttonOrder: string[];
  onReorder: (draggedKey: string, dropKey:string) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
}

const isReadCall = (arg: any): arg is ReadCall => {
  return typeof arg === 'object' && arg !== null && '$read' in arg;
};

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

const formatReadData = (data: any): string => {
  if (data === null || data === undefined) {
    return 'null';
  }
  return JSON.stringify(
    data,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
};


export const MainView: React.FC<MainViewProps> = ({ settings, setSettings, visibleButtons, setVisibleButtons, buttonOrder, onReorder, showNotification }) => {
  const { address, chainId, isConnected } = useAccount();
  const { sendTransaction } = useSendTransaction();
  const wagmiConfig = useConfig();

  const [hoveredDescription, setHoveredDescription] = useState<string>('Hover over a button to see its description.');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [currentConfigForInput, setCurrentConfigForInput] = useState<{ key: string; config: ButtonConfig } | null>(null);
  
  const [readData, setReadData] = useState<any>(null);
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

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
      onReorder(draggedKey, dropKey);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    draggedItemKey.current = null;
  };


  const handleSaveButton = (key: string, config: ButtonConfig) => {
    const newSettings = { ...settings, [key]: config };
    setSettings(newSettings);
    setVisibleButtons({ ...visibleButtons, [key]: true });
    showNotification(`Button "${key}" saved successfully!`, 'success');
  };
  
  const switchNetworkIfNeeded = useCallback(async (targetChainId: number, chainConfig?: ButtonConfig) => {
    if (!isConnected || chainId === targetChainId) {
        return true;
    }

    try {
        await switchChain(wagmiConfig, { chainId: targetChainId });
        return true;
    } catch (switchError: any) {
        const code = switchError.cause?.code || switchError.code;
        if (code === 4902 && chainConfig) { // Chain not found, and we have config to add it
            try {
                if (!chainConfig.chainName || !chainConfig.rpcUrls?.length || !chainConfig.nativeCurrency) {
                    showNotification('Chain not found in wallet. Please add it manually or provide complete chain details in the button config.', 'error');
                    return false;
                }
                
                const client = await getWalletClient(wagmiConfig);
                if (!client) {
                    showNotification('Wallet client not available.', 'error');
                    return false;
                }
                await client.addChain({
                    chain: {
                        id: targetChainId,
                        name: chainConfig.chainName,
                        nativeCurrency: chainConfig.nativeCurrency,
                        rpcUrls: {
                            default: { http: chainConfig.rpcUrls },
                            public: { http: chainConfig.rpcUrls },
                        },
                        blockExplorers: chainConfig.blockExplorerUrls?.length ? {
                            default: { name: `${chainConfig.chainName} Explorer`, url: chainConfig.blockExplorerUrls[0] },
                        } : undefined,
                    }
                });
                await switchChain(wagmiConfig, { chainId: targetChainId });
                return true;
            } catch (addError: any) {
                const message = addError.message?.includes('User rejected the request')
                    ? 'Request to add network rejected.'
                    : `Failed to add network: ${addError.message?.split(/[\(.]/)[0]}`;
                showNotification(message, 'error');
                return false;
            }
        } else {
            const message = switchError.message?.includes('User rejected the request')
                ? 'Request to switch network rejected.'
                : `Failed to switch network: ${switchError.message?.split(/[\(.]/)[0]}`;
            showNotification(message, 'error');
            return false;
        }
    }
  }, [chainId, isConnected, showNotification, wagmiConfig]);

  const executeRead = useCallback(async (config: ButtonConfig, args: any[] = []): Promise<any | null> => {
    if (!isConnected || !address) return null;
    
    const networkReady = await switchNetworkIfNeeded(config.id, config);
    if (!networkReady) return null;

    setIsReading(true);
    setReadData(null);
    setReadError(null);

    try {
      // FIX: Added authorizationList: undefined to the readContract parameters to resolve a type error
      // likely caused by a version mismatch between wagmi and viem, where a transaction-related
      // property was being incorrectly required for a read-only call.
      const data = await readContract(wagmiConfig, {
        address: config.address as `0x${string}`,
        abi: config.abi as Abi,
        functionName: config.functionName!,
        args,
        chainId: config.id,
        authorizationList: undefined,
      });

      setReadData(data);
      return data;
    } catch (error: any) {
      const message = error.shortMessage || error.message?.split(/[\(.]/)[0] || "An unknown error occurred.";
      setReadError(`Read failed: ${message}`);
      console.error("Read Contract Error:", error);
      return null;
    } finally {
      setIsReading(false);
    }
  }, [isConnected, address, wagmiConfig, switchNetworkIfNeeded]);
  
  const executeTransaction = useCallback(async (config: ButtonConfig, args: any[] = []): Promise<boolean> => {
    if (!isConnected || !address) {
        showNotification('Please connect your wallet first.', 'info');
        return false;
    }
    
    const networkReady = await switchNetworkIfNeeded(config.id, config);
    if (!networkReady) return false;

    let transactionData: `0x${string}` | undefined;
    try {
        if (config.abi && config.functionName) {
            transactionData = encodeFunctionData({ 
              abi: config.abi as Abi, 
              functionName: config.functionName, 
              args 
            });
        } else if (config.data) {
            transactionData = config.data as `0x${string}`;
        } else {
            showNotification('Button has no transaction data.', 'error');
            return false;
        }
    } catch (error: any) {
        showNotification(`Error encoding transaction data: ${error.message}`, 'error');
        return false;
    }
    
    return new Promise((resolve) => {
      sendTransaction({
          to: config.address as `0x${string}`,
          value: config.value ? BigInt(config.value) : undefined,
          data: transactionData,
          gas: config.gas ? BigInt(config.gas) : undefined,
      }, {
          onSuccess: (hash) => {
              showNotification(`Transaction sent! Hash: ${hash.slice(0,10)}...`, 'success');
              resolve(true);
          },
          onError: (error) => {
              const message = error.message.includes('User rejected the request') 
                  ? 'Transaction rejected.' 
                  : `Transaction failed: ${error.message.split(/[\(.]/)[0]}`;

              showNotification(message, 'info');
              resolve(false);
          }
      });
    });
  }, [isConnected, address, showNotification, sendTransaction, switchNetworkIfNeeded]);
  
  const processArgsForReads = useCallback(async (parentConfig: ButtonConfig, args: any[]): Promise<any[] | null> => {
      const processedArgs = [...args];
      const readPromises: Promise<any>[] = [];
      const readIndices: number[] = [];

      for (const [index, arg] of processedArgs.entries()) {
          if (isReadCall(arg)) {
              readIndices.push(index);
              const readConfig = arg.$read;

              const promise = (async () => {
                  // Resolve nested arguments first (recursively)
                  const nestedArgs = await processArgsForReads(parentConfig, readConfig.args);
                  if (nestedArgs === null) {
                      throw new Error(`Failed to resolve arguments for nested read at index ${index}.`);
                  }

                  const targetAddress = readConfig.address || parentConfig.address;
                  const targetId = parentConfig.id;
                  
                  const networkReady = await switchNetworkIfNeeded(targetId, parentConfig);
                  if (!networkReady) {
                      throw new Error(`Network switch failed for read call at index ${index}.`);
                  }

                  // FIX: Added authorizationList: undefined to the readContract parameters to resolve a type error
                  // likely caused by a version mismatch between wagmi and viem.
                  return readContract(wagmiConfig, {
                      address: targetAddress as `0x${string}`,
                      abi: readConfig.abi as Abi,
                      functionName: readConfig.functionName,
                      args: nestedArgs,
                      chainId: targetId,
                      authorizationList: undefined,
                  });
              })();
              readPromises.push(promise);
          } else if (typeof arg === 'string' && arg === '$userAddress') {
              if (!address) {
                  showNotification('Wallet not connected.', 'error');
                  return null;
              }
              processedArgs[index] = address;
          }
      }

      if (readPromises.length > 0) {
          try {
              const readResults = await Promise.all(readPromises);
              readResults.forEach((result, i) => {
                  const originalIndex = readIndices[i];
                  processedArgs[originalIndex] = result;
              });
          } catch (error: any) {
              const message = error.shortMessage || error.message?.split(/[\(.]/)[0] || "An unknown error occurred.";
              showNotification(`Embedded read failed: ${message}`, 'error');
              console.error("Embedded Read Error:", error);
              return null; // Indicates failure
          }
      }

      return processedArgs;
  }, [address, showNotification, switchNetworkIfNeeded, wagmiConfig]);

  const handleTransaction = async (key: string, config: ButtonConfig) => {
    if (!isConnected) {
        showNotification('Please connect your wallet first.', 'info');
        return;
    }
    
    setHoveredDescription(config.description || 'No description available for this action.');

    if (config.abi) {
        try {
            const abi = config.abi as Abi;
            let functionName = config.functionName;
             if (!functionName) {
                const functionsInAbi = abi.filter((item): item is AbiFunction => item.type === 'function');
                if (functionsInAbi.length === 1) {
                    functionName = functionsInAbi[0].name;
                }
            }
            const functionAbi = abi.find(
                (item): item is AbiFunction => item.type === 'function' && item.name === functionName
            );

            if (functionAbi && functionAbi.inputs && functionAbi.inputs.length > 0) {
                const hasUnfilledArgs = !(config.args && config.args.length === functionAbi.inputs.length && 
                    !config.args.some(arg => arg === null || arg === undefined || arg === '' || isReadCall(arg))
                );

                if (hasUnfilledArgs) {
                    setCurrentConfigForInput({ key, config });
                    setIsInputModalOpen(true);
                    return;
                }
            }
        } catch (error: any) {
            showNotification(`ABI Error: ${error.message}`, 'error');
            return;
        }
    }
    
    const finalArgs = await processArgsForReads(config, config.args || []);
    if (finalArgs === null) return; // Error occurred and was notified

    if (config.readOnly) {
      await executeRead(config, finalArgs);
    } else {
      await executeTransaction(config, finalArgs);
    }
  };

  const handleInputModalSubmit = useCallback(async (args: any[]) => {
    if (currentConfigForInput) {
        const { config } = currentConfigForInput;
        const finalArgs = await processArgsForReads(config, args);
        if (finalArgs === null) {
            // Error handled in processArgs, just clean up modal state
            setIsInputModalOpen(false);
            setCurrentConfigForInput(null);
            return;
        }

        if (config.readOnly) {
          await executeRead(config, finalArgs);
        } else {
          await executeTransaction(config, finalArgs);
        }
    }
    setIsInputModalOpen(false);
    setCurrentConfigForInput(null);
  }, [currentConfigForInput, executeTransaction, executeRead, processArgsForReads]);

  const handleInputModalSave = useCallback((args: any[]) => {
    if (!currentConfigForInput) return;

    const { key, config } = currentConfigForInput;
    const updatedConfig = { ...config, args };
    const newSettings = { ...settings, [key]: updatedConfig };
    
    setSettings(newSettings);
    
    setCurrentConfigForInput({ key, config: updatedConfig });
  }, [currentConfigForInput, settings, setSettings]);

  const handleInputModalClose = useCallback(() => {
    setIsInputModalOpen(false);
    setCurrentConfigForInput(null);
  }, []);


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
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveButton}
        showNotification={showNotification}
        settings={settings}
      />

      <InputModal
          isOpen={isInputModalOpen}
          onClose={handleInputModalClose}
          config={currentConfigForInput ? currentConfigForInput.config : null}
          onSubmit={handleInputModalSubmit}
          onSave={handleInputModalSave}
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
              <div className="h-24 overflow-y-auto text-gray-300 font-mono text-sm">
                  <p className="whitespace-pre-wrap">{hoveredDescription}</p>
              </div>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 font-semibold flex items-center justify-center"
              aria-label="Add New Button"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Button
            </button>
            
            {/* Read Result Panel */}
            <div className="bg-gray-800 p-4 rounded-lg self-start w-full">
              <div className="h-24 overflow-y-auto text-gray-300 font-mono text-sm" aria-live="polite">
                  {isReading && <p className="animate-pulse">Reading from contract...</p>}
                  {readError && <pre className="text-red-400 whitespace-pre-wrap">{readError}</pre>}
                  {readData !== null && <pre className="whitespace-pre-wrap">{formatReadData(readData)}</pre>}
              </div>
            </div>
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
                    onClick={() => handleTransaction(key, config)}
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
            onClick={() => setIsAddModalOpen(true)}
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