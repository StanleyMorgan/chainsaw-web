import { useCallback } from 'react';
import type { ButtonConfig, ReadCall } from '../types';
import type { NotificationData } from '../components/Notification';
import { useAccount, useSendTransaction, useConfig } from 'wagmi';
import { readContract, getWalletClient } from '@wagmi/core';
import { encodeFunctionData, type Abi, type AbiFunction } from 'viem';

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

export const useChainsawActions = (showNotification: (message: string, type: NotificationData['type'], duration?: number) => void) => {
  const { address, chainId, isConnected } = useAccount();
  const { sendTransaction } = useSendTransaction();
  const wagmiConfig = useConfig();

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
          // FIX: Add missing 'authorizationList' property to satisfy wagmi's ReadContractParameters type.
          const readResult = await readContract(wagmiConfig, {
            address: readCallConfig.address as `0x${string}`,
            abi: readCallConfig.abi as Abi,
            functionName: readCallConfig.functionName,
            args: processedReadArgs,
            chainId: parentConfig.id,
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

      // FIX: Add missing 'authorizationList' property to satisfy wagmi's ReadContractParameters type.
      const data = await readContract(wagmiConfig, {
        address: execConfig.address as `0x${string}`,
        abi: execConfig.abi as Abi,
        functionName: execConfig.functionName,
        args: processedArgs,
        chainId: execConfig.id,
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
        
        const txParams: {
            to?: `0x${string}`;
            value: bigint;
            data?: `0x${string}`;
            gas?: bigint;
            chainId: number;
        } = {
            value: BigInt(execConfig.value),
            data: txData,
            gas: execConfig.gas ? BigInt(execConfig.gas) : undefined,
            chainId: execConfig.id,
        };
        
        if (execConfig.address && execConfig.address !== '') {
            txParams.to = execConfig.address as `0x${string}`;
        }

        if (!txParams.to && !txParams.data) {
            showNotification('Contract deployment requires "data" (bytecode).', 'error');
            return;
        }
        
        sendTransaction(txParams, {
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
  
  return {
      executeRead,
      handleTransaction,
      getExecutionConfig,
  };
};