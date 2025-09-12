

import React, { useState, useRef, useCallback } from 'react';
import type { Settings, VisibleButtons, ButtonConfig, ReadCall } from '../types';
import type { NotificationData } from './Notification';
import { useAccount, useSendTransaction, useConfig } from 'wagmi';
// FIX: `addChain` is no longer exported from `wagmi/actions`. Replaced with `getWalletClient` to use the viem client's `addChain` method.
// FIX: `readContract`, `switchChain`, and `getWalletClient` are now imported from `@wagmi/core` in wagmi v2 to fix type errors.
import { readContract, getWalletClient } from '@wagmi/core';
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
  // FIX: Updated the `showNotification` prop type to accept an optional `duration` argument, matching its definition in App.tsx and resolving a type error.
  showNotification: (message: string, type: NotificationData['type'], duration?: number) => void;
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
    if (!isConnected || !address || chainId === targetChainId) {
        return true;
    }

    try {
        const client = await getWalletClient(wagmiConfig);
        if (!client) {
            showNotification('Wallet client not available.', 'error');
            return false;
        }
        // Use the viem client's switchChain directly to bypass wagmi's configured chains check.
        // This restores the ability to switch to any chain the user's wallet supports.
        await client.switchChain({ id: targetChainId });
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
                await client.switchChain({ id: targetChainId });
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
  }, [chainId, isConnected, address, showNotification, wagmiConfig]);

  // Helper to check if an argument is a special $read object
  const isReadCall = (arg: any): arg is ReadCall => {
    return typeof arg === 'object' && arg !== null && '$read' in arg;
  };

  // Helper function to infer functionName if an ABI has only one function.
  // Moved inside the component to avoid polluting the module scope.
  const getExecutionConfig = useCallback((config: ButtonConfig): ButtonConfig => {
    const executionConfig = { ...config };
    if (executionConfig.abi && !executionConfig.functionName) {
      try {
        const abi = executionConfig.abi as Abi;
        const functionsInAbi = abi.filter((item): item is AbiFunction => item.type === 'function');
        if (functionsInAbi.length === 1) {
          executionConfig.functionName = functionsInAbi[0].name;
        }
      } catch (e) {
        // Ignore ABI parsing errors here; they will be handled by the caller.
      }
    }
    return executionConfig;
  }, []);

  // Robustly extracts a single return value from a contract read result.
  // Moved inside the component as it's a specific helper for this view.
  const extractSingleValue = useCallback((result: any, funcAbi: AbiFunction): any => {
    if (!funcAbi.outputs || funcAbi.outputs.length !== 1) {
      throw new Error(`$read call must point to a function with exactly one output. Found ${funcAbi.outputs?.length ?? 0}.`);
    }
    
    // If result is not an array or object, it's already the primitive value.
    if (typeof result !== 'object' || result === null) {
      return result;
    }

    // If result is an array, viem returns the value as the first element.
    if (Array.isArray(result)) {
      return result[0];
    }
    
    // If result is an object, viem returns it with a named property matching the output name.
    const outputDef = funcAbi.outputs[0];
    if (outputDef.name && outputDef.name in result) {
      return (result as Record<string, any>)[outputDef.name];
    }

    // Fallback for unexpected object structures that don't match the ABI name.
    const keys = Object.keys(result);
    if (keys.length === 1) {
      return (result as Record<string, any>)[keys[0]];
    }

    throw new Error('Failed to extract a single primitive value from read result object.');
  }, []);

  const executeRead = useCallback(async (config: ButtonConfig, args: any[] = []): Promise<any | null> => {
    if (!isConnected || !address) return null;
    
    const execConfig = getExecutionConfig(config);
    const networkReady = await switchNetworkIfNeeded(execConfig.id, execConfig);
    if (!networkReady) return null;

    try {
      if (!execConfig.functionName) {
        throw new Error("Function name could not be determined from ABI.");
      }
      // FIX: Set `account: undefined` to resolve a wagmi v2 type error where `readContract`
      // incorrectly requires transaction-related properties. This helps TypeScript
      // infer the correct overload for a read-only call.
      // FIX: Added `authorizationList: undefined` to address a wagmi v2 type error
      // where `readContract` incorrectly requires a transaction-related property.
      const data = await readContract(wagmiConfig, {
        address: execConfig.address as `0x${string}`,
        abi: execConfig.abi as Abi,
        functionName: execConfig.functionName,
        args: args,
        chainId: execConfig.id,
        account: undefined,
        authorizationList: undefined,
      });
      showNotification(`Result: ${formatReadData(data)}`, 'read', 5000);
      return data;
    } catch (error: any) {
      const message = error.shortMessage || error.message;
      showNotification(`Read error: ${message.split(/[\(.]/)[0]}`, 'error');
      console.error(error);
      return null;
    }
  }, [isConnected, address, wagmiConfig, switchNetworkIfNeeded, getExecutionConfig, showNotification]);

  const processArgsForReads = useCallback(async (
    args: (string | number | ReadCall)[] | undefined,
    parentConfig: ButtonConfig
  ): Promise<any[] | null> => {
    if (!args) return [];
    if (!address) {
      showNotification('Wallet not connected.', 'error');
      return null;
    }

    const processedArgs = [];
    for (const arg of args) {
      if (isReadCall(arg)) {
        const readCallConfig = getExecutionConfig({
          ...arg.$read,
          id: parentConfig.id, // Inherit parent chainId for the read call
          address: arg.$read.address || parentConfig.address, // Inherit parent address if not specified
          color: parentConfig.color, // Dummy value to satisfy type
          value: parentConfig.value, // Dummy value to satisfy type
        });
        
        // FIX: Add a guard to ensure functionName is defined before it's used.
        // This resolves a TypeScript error where `undefined` could be passed to `readContract`.
        if (!readCallConfig.functionName) {
            showNotification(`Function name could not be determined from ABI for $read call.`, 'error');
            return null;
        }

        const abi = readCallConfig.abi as Abi;
        const funcAbi = abi.find(
          (item): item is AbiFunction => item.type === 'function' && item.name === readCallConfig.functionName
        );

        if (!funcAbi) {
          showNotification(`Function '${readCallConfig.functionName}' not found in ABI for $read call.`, 'error');
          return null;
        }

        const processedReadArgs = await processArgsForReads(arg.$read.args, parentConfig);
        if (processedReadArgs === null) return null;

        const networkReady = await switchNetworkIfNeeded(parentConfig.id, parentConfig);
        if (!networkReady) return null;

        try {
          // FIX: Set `account: undefined` to resolve a wagmi v2 type error where `readContract`
          // incorrectly requires transaction-related properties. This helps TypeScript
          // infer the correct overload for a read-only call.
          // FIX: Added `authorizationList: undefined` to address a wagmi v2 type error
          // where `readContract` incorrectly requires a transaction-related property.
          const readResult = await readContract(wagmiConfig, {
            address: readCallConfig.address as `0x${string}`,
            abi: readCallConfig.abi as Abi,
            functionName: readCallConfig.functionName,
            args: processedReadArgs,
            chainId: parentConfig.id,
            account: undefined,
            authorizationList: undefined,
          });
          
          const finalValue = extractSingleValue(readResult, funcAbi);
          processedArgs.push(finalValue);

        } catch (error: any) {
          const message = error.shortMessage || error.message;
          showNotification(`$read error: ${message.split(/[\(.]/)[0]}`, 'error');
          console.error(error);
          return null;
        }
      } else if (arg === '$userAddress') {
        processedArgs.push(address);
      } else {
        processedArgs.push(arg);
      }
    }
    return processedArgs;
  }, [address, showNotification, wagmiConfig, switchNetworkIfNeeded, getExecutionConfig, extractSingleValue]);
  
  const handleTransaction = useCallback(async (config: ButtonConfig, args?: any[]) => {
    if (!isConnected || !address) return;

    const execConfig = getExecutionConfig(config);
    const networkReady = await switchNetworkIfNeeded(execConfig.id, execConfig);
    if (!networkReady) return;

    try {
        let finalArgs: any[] | null = [];
        // Only process args if there's an ABI. For raw data transactions, args are not used.
        if (execConfig.abi) {
            finalArgs = await processArgsForReads(args || execConfig.args, execConfig);
            if (finalArgs === null) return; // Error occurred during arg processing
        }

        let txData: `0x${string}` | undefined;
        if (execConfig.data) {
            txData = execConfig.data as `0x${string}`;
        } else if (execConfig.abi) {
            if (execConfig.functionName) {
                txData = encodeFunctionData({
                    abi: execConfig.abi as Abi,
                    functionName: execConfig.functionName,
                    args: finalArgs,
                });
            }
        }

        if (!txData) {
            // FIX: Check if there are inputs. If not, don't show an error, as it's a valid call.
            const func = (execConfig.abi as Abi)?.find(
                (item): item is AbiFunction => item.type === 'function' && item.name === execConfig.functionName
            );
            if (func && func.inputs?.length > 0) {
                 showNotification('Button has no transaction data and the ABI function requires arguments. Please configure arguments.', 'error');
                 return;
            } else if (!func) {
                showNotification('Button has no transaction data.', 'error');
                return;
            }
        }
        
        sendTransaction({
            to: execConfig.address as `0x${string}`,
            value: BigInt(execConfig.value),
            data: txData,
            gas: execConfig.gas ? BigInt(execConfig.gas) : undefined,
            chainId: execConfig.id,
        }, {
            onSuccess: (hash) => showNotification(`Transaction sent! Hash: ${hash}`, 'success'),
            onError: (error) => {
                const message = error.message.split(/[\(.]/)[0];
                showNotification(`Transaction failed: ${message}`, 'error');
            }
        });
    } catch (error: any) {
        console.error(error);
        showNotification(`An unexpected error occurred: ${error.message}`, 'error');
    }
  }, [isConnected, address, switchNetworkIfNeeded, getExecutionConfig, processArgsForReads, sendTransaction, showNotification]);

  const handleButtonClick = (key: string, config: ButtonConfig) => {
    if (!isConnected || !address) {
      showNotification('Please connect your wallet first.', 'info');
      return;
    }
    
    if (config.type === 'chained' && config.steps) {
        // Chained transaction logic would go here.
        // For now, we just show a message.
        showNotification("Chained actions are not yet implemented.", "info");
        return;
    }

    const execConfig = getExecutionConfig(config);
    if (execConfig.readOnly) {
      executeRead(execConfig, execConfig.args as any[]);
      return;
    }
    
    let hasEmptyArgs = false;

    if (execConfig.abi) {
        const func = (execConfig.abi as Abi)?.find(
          (item): item is AbiFunction => item.type === 'function' && item.name === execConfig.functionName
        );

        // Check if any defined arguments (excluding special values) are empty
        if (func?.inputs && func.inputs.length > 0) {
            hasEmptyArgs = func.inputs.some((input, index) => {
                const arg = execConfig.args?.[index];
                if (input.type === 'tuple') {
                    // For tuples, we'd need a more complex check, but for now we assume they might need input
                    return true;
                }
                return arg === undefined || arg === null || arg === '';
            });
        }
    }

    if (hasEmptyArgs) {
        setCurrentConfigForInput({ key, config: execConfig });
        setIsInputModalOpen(true);
    } else {
        handleTransaction(execConfig);
    }
  };

  const handleInputModalSubmit = (args: any[]) => {
    if (currentConfigForInput) {
      handleTransaction(currentConfigForInput.config, args);
    }
    setIsInputModalOpen(false);
    setCurrentConfigForInput(null);
  };
  
  const handleInputModalSave = (newArgs: any[]) => {
    if (currentConfigForInput) {
        const { key, config } = currentConfigForInput;
        const newConfig = { ...config, args: newArgs };
        handleSaveButton(key, newConfig);
    }
  };
  

  const visibleButtonKeys = buttonOrder.filter(key => visibleButtons[key] !== false);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-12">
          {isConnected ? (
             <div className="space-y-6">
                {visibleButtonKeys.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {visibleButtonKeys.map(key => (
                           <div
                              key={key}
                              draggable
                              onDragStart={(e) => handleDragStart(e, key)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, key)}
                              onDragEnd={handleDragEnd}
                              onMouseEnter={() => setHoveredDescription(settings[key]?.description || 'No description available.')}
                              className="cursor-move"
                           >
                              <ActionButton
                                buttonKey={key}
                                config={settings[key]}
                                onClick={() => handleButtonClick(key, settings[key])}
                              />
                           </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <p className="mb-4">No buttons are visible.</p>
                        <p>Go to Settings to configure or enable them.</p>
                    </div>
                )}
                
                <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700 min-h-[60px] flex items-center justify-center">
                    <p className="text-gray-400 italic text-center">{hoveredDescription}</p>
                </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <h2 className="text-3xl font-bold mb-4">Welcome to Chainsaw</h2>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto">The ultimate tool for power users to interact with smart contracts. Connect your wallet to get started.</p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          )}
        </div>
      </div>
      {isConnected && (
         <div className="fixed bottom-20 right-5">
            <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-green-600 text-white rounded-full p-4 shadow-lg hover:bg-green-700 transition-colors duration-200"
                title="Add New Button"
                aria-label="Add New Button"
            >
                <PlusIcon className="w-8 h-8" />
            </button>
        </div>
      )}

      <AddButtonModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveButton}
        showNotification={showNotification}
        settings={settings}
      />
      
      <InputModal 
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        config={currentConfigForInput?.config || null}
        onSubmit={handleInputModalSubmit}
        onSave={handleInputModalSave}
        showNotification={showNotification}
      />
    </>
  );
};