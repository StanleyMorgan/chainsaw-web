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
  showNotification: (message: string, type: NotificationData['type'], duration?: number) => void;
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  profileNames: string[];
}

const ProfileSelector: React.FC<{
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  profileNames: string[];
}> = ({ activeProfile, setActiveProfile, profileNames }) => {
  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
      <label htmlFor="profile-select-main" className="block text-sm font-medium text-gray-300 mb-2">
        Active Profile
      </label>
      <select
        id="profile-select-main"
        value={activeProfile}
        onChange={(e) => setActiveProfile(e.target.value)}
        className="w-full p-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        {profileNames.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </div>
  );
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


export const MainView: React.FC<MainViewProps> = ({ settings, setSettings, visibleButtons, buttonOrder, onReorder, showNotification, activeProfile, setActiveProfile, profileNames }) => {
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

  const isReadCall = (arg: any): arg is ReadCall => {
    return typeof arg === 'object' && arg !== null && '$read' in arg;
  };

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

  const extractSingleValue = useCallback((result: any, funcAbi: AbiFunction): any => {
    if (!funcAbi.outputs || funcAbi.outputs.length !== 1) {
      throw new Error(`$read call must point to a function with exactly one output. Found ${funcAbi.outputs?.length ?? 0}.`);
    }
    
    if (typeof result !== 'object' || result === null) {
      return result;
    }

    if (Array.isArray(result)) {
      return result[0];
    }
    
    const outputDef = funcAbi.outputs[0];
    if (outputDef.name && outputDef.name in result) {
      return (result as Record<string, any>)[outputDef.name];
    }

    const keys = Object.keys(result);
    if (keys.length === 1) {
      return (result as Record<string, any>)[keys[0]];
    }

    throw new Error('Failed to extract a single primitive value from read result object.');
  }, []);

  const processArgsForReads = useCallback(async (
    args: any[] | undefined,
    parentConfig: ButtonConfig
  ): Promise<any[] | null> => {
    if (!args) return [];
    if (!address) {
      showNotification('Wallet not connected.', 'error');
      return null;
    }

    const deepReplaceUserAddress = (data: any): any => {
      if (typeof data === 'string') {
        return data === '$userAddress' ? address : data;
      }
      if (Array.isArray(data)) {
        return data.map(item => deepReplaceUserAddress(item));
      }
      if (typeof data === 'object' && data !== null && !isReadCall(data)) {
        const newData: { [key: string]: any } = {};
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            newData[key] = deepReplaceUserAddress(data[key]);
          }
        }
        return newData;
      }
      return data;
    };

    const processedArgs = [];
    for (const arg of args) {
      if (isReadCall(arg)) {
        const readCallConfig = getExecutionConfig({
          ...arg.$read,
          id: parentConfig.id,
          address: arg.$read.address || parentConfig.address,
          color: parentConfig.color,
          value: parentConfig.value,
        });
        
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
      } else {
        processedArgs.push(deepReplaceUserAddress(arg));
      }
    }
    return processedArgs;
  }, [address, showNotification, wagmiConfig, switchNetworkIfNeeded, getExecutionConfig, extractSingleValue]);

  const executeRead = useCallback(async (config: ButtonConfig, args: any[] = []): Promise<any | null> => {
    if (!isConnected || !address) return null;
    
    const execConfig = getExecutionConfig(config);
    const networkReady = await switchNetworkIfNeeded(execConfig.id, execConfig);
    if (!networkReady) return null;

    try {
      if (!execConfig.functionName) {
        throw new Error("Function name could not be determined from ABI.");
      }
      
      const processedArgs = await processArgsForReads(args, execConfig);
      if (processedArgs === null) {
        return null;
      }

      const data = await readContract(wagmiConfig, {
        address: execConfig.address as `0x${string}`,
        abi: execConfig.abi as Abi,
        functionName: execConfig.functionName,
        args: processedArgs,
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
  }, [isConnected, address, wagmiConfig, switchNetworkIfNeeded, getExecutionConfig, showNotification, processArgsForReads]);
  
  const handleTransaction = useCallback(async (config: ButtonConfig, args?: any[]) => {
    if (!isConnected || !address) return;

    const execConfig = getExecutionConfig(config);
    const networkReady = await switchNetworkIfNeeded(execConfig.id, execConfig);
    if (!networkReady) return;

    try {
        let finalArgs: any[] | null = [];
        if (execConfig.abi) {
            finalArgs = await processArgsForReads(args || execConfig.args, execConfig);
            if (finalArgs === null) return;
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
            onSuccess: () => showNotification('Transaction sent successfully!', 'success'),
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

        if (func?.inputs && func.inputs.length > 0) {
            hasEmptyArgs = func.inputs.some((input, index) => {
                const arg = execConfig.args?.[index];
                if (input.type === 'tuple') {
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
      <div>
        {isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Left Sidebar */}
            <div className="lg:col-span-5 xl:col-span-4">
                <div className="lg:sticky lg:top-24 space-y-4">
                    {/* Description Panel */}
                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 h-48 flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-2 flex-shrink-0 border-b border-gray-700 pb-2">Action Description</h3>
                        <div className="overflow-y-auto pr-2 flex-grow">
                            <p className="text-gray-300 whitespace-pre-wrap">{hoveredDescription}</p>
                        </div>
                    </div>
                    {/* Profile Selector */}
                    <ProfileSelector 
                        activeProfile={activeProfile}
                        setActiveProfile={setActiveProfile}
                        profileNames={profileNames}
                    />
                    {/* Add Button */}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full bg-green-600 text-white rounded-lg py-3 px-4 shadow-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center font-semibold"
                        title="Add New Button"
                        aria-label="Add New Button"
                    >
                        <PlusIcon className="w-6 h-6 mr-2" />
                        <span>Add Button</span>
                    </button>
                </div>
            </div>
            
            {/* Main Content */}
            <div className="lg:col-span-7 xl:col-span-8">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleButtonKeys.map(key => {
                  const config = settings[key];
                  if (!config) return null;

                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, key)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, key)}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={() => setHoveredDescription(config.description || 'No description provided.')}
                      onMouseLeave={() => setHoveredDescription('Hover over a button to see its description.')}
                      className="cursor-move"
                      title={config.description || key}
                    >
                      <ActionButton
                        buttonKey={key}
                        config={config}
                        onClick={() => handleButtonClick(key, config)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to Chainsaw</h2>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Your powerful tool for interacting with smart contracts. Connect your wallet to get started.
            </p>
            <div className="inline-block">
              <ConnectButton />
            </div>
          </div>
        )}
      </div>

      <AddButtonModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveButton}
        showNotification={showNotification}
        settings={settings}
      />
      
      {isInputModalOpen && currentConfigForInput && (
        <InputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          config={currentConfigForInput.config}
          onSubmit={handleInputModalSubmit}
          onSave={handleInputModalSave}
          showNotification={showNotification}
        />
      )}
    </>
  );
};