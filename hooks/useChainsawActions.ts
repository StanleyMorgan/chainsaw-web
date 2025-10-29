import { useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount, useSwitchChain } from 'wagmi';
import { parseEther, formatUnits, isAddress } from 'viem';
import type { Abi } from 'viem';
import type { ButtonConfig, ReadCall, NotificationData } from '../types';

export const useChainsawActions = (showNotification: (message: string, type: NotificationData['type'], duration?: number) => void) => {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const { chain } = useAccount();
    const { switchChainAsync } = useSwitchChain();

    const resolveReadCalls = useCallback(async (args: any[], parentConfig: ButtonConfig): Promise<any[]> => {
        const resolvedArgs = [];
        for (const arg of args) {
            if (arg && typeof arg === 'object' && '$read' in arg) {
                const readCall: ReadCall['$read'] = arg.$read;
                if (!publicClient) {
                    throw new Error('Public client not available for read call.');
                }
                
                // Ensure correct chain is used for the read
                if (parentConfig.id && chain?.id !== Number(parentConfig.id)) {
                    if (switchChainAsync) {
                         await switchChainAsync({ chainId: Number(parentConfig.id) });
                    } else {
                        throw new Error(`Wrong network for read call. Please switch to chain ID ${parentConfig.id}.`);
                    }
                }

                try {
                    const data = await publicClient.readContract({
                        address: (readCall.address || parentConfig.address) as `0x${string}`,
                        abi: readCall.abi as Abi,
                        functionName: readCall.functionName,
                        args: readCall.args,
                    });
                    resolvedArgs.push(data);
                } catch (error: any) {
                    console.error("Read call failed:", error);
                    throw new Error(`Failed to execute read call for ${readCall.functionName}: ${error.shortMessage || error.message}`);
                }
            } else {
                resolvedArgs.push(arg);
            }
        }
        return resolvedArgs;
    }, [publicClient, chain, switchChainAsync]);

    const getExecutionConfig = useCallback((config: ButtonConfig): ButtonConfig => {
        // This function could resolve placeholders if needed, but for now, it's a simple passthrough.
        // It's structured to be extensible.
        return { ...config };
    }, []);
    
    const executeRead = useCallback(async (config: ButtonConfig, args: any[]) => {
        if (!publicClient) {
            showNotification('Wallet not connected or client not ready.', 'error');
            return;
        }

        try {
            if (config.id && chain?.id !== Number(config.id)) {
                if(switchChainAsync) {
                    await switchChainAsync({ chainId: Number(config.id) });
                } else {
                     showNotification(`Please switch to network with chain ID ${config.id}`, 'info');
                     return;
                }
            }

            const resolvedArgs = args ? await resolveReadCalls(args, config) : [];

            const result = await publicClient.readContract({
                address: config.address as `0x${string}`,
                abi: config.abi as Abi,
                functionName: config.functionName!,
                args: resolvedArgs,
            });

            let displayResult: string;
            if (typeof result === 'bigint') {
                const decimals = (config as any).decimals ?? 18; // Default to 18 if not specified
                displayResult = formatUnits(result, decimals);
            } else if (Array.isArray(result)) {
                displayResult = JSON.stringify(result, null, 2);
            } else {
                displayResult = String(result);
            }

            showNotification(`Read successful:\n${displayResult}`, 'read');
        } catch (error: any) {
            console.error("Read failed:", error);
            showNotification(`Read failed: ${error.shortMessage || error.message}`, 'error');
        }
    }, [publicClient, showNotification, chain, switchChainAsync, resolveReadCalls]);

    const handleTransaction = useCallback(async (config: ButtonConfig, dynamicArgs?: any[]) => {
        if (!walletClient) {
            showNotification('Please connect your wallet.', 'info');
            return;
        }
        
        try {
            if (config.id && chain?.id !== Number(config.id)) {
                if (switchChainAsync) {
                    await switchChainAsync({ chainId: Number(config.id) });
                } else {
                    showNotification(`Please switch to network with chain ID ${config.id}`, 'info');
                    return;
                }
            }
            
            const finalArgs = dynamicArgs || config.args || [];
            const isDeploy = !config.address || config.address === '';

            let hash;
            if (config.abi) {
                const resolvedArgs = await resolveReadCalls(finalArgs, config);

                if (isDeploy) {
                    if (!config.data) { // Assuming data is bytecode for deployment
                        throw new Error("Deployment requires bytecode in the 'data' field.");
                    }
                    hash = await walletClient.deployContract({
                        abi: config.abi as Abi,
                        bytecode: config.data as `0x${string}`,
                        args: resolvedArgs,
                        value: parseEther(config.value || '0'),
                    });
                } else {
                    if (!isAddress(config.address)) {
                        throw new Error(`Invalid contract address: ${config.address}`);
                    }

                    const request = {
                        address: config.address as `0x${string}`,
                        abi: config.abi as Abi,
                        functionName: config.functionName!,
                        args: resolvedArgs,
                        value: parseEther(config.value || '0'),
                        gas: config.gas ? BigInt(config.gas) : undefined,
                    };
                    hash = await walletClient.writeContract(request);
                }
            } else if (config.data) {
                if (!isAddress(config.address)) {
                    throw new Error(`Invalid contract address: ${config.address}`);
                }
                hash = await walletClient.sendTransaction({
                    to: config.address as `0x${string}`,
                    value: parseEther(config.value || '0'),
                    data: config.data as `0x${string}`,
                    gas: config.gas ? BigInt(config.gas) : undefined,
                });
            } else {
                throw new Error("Transaction configuration is invalid. Must provide ABI or data.");
            }

            showNotification(`Transaction sent! Hash: ${hash}`, 'success');

            if (publicClient) {
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'success') {
                    showNotification(`Transaction confirmed! Hash: ${hash}`, 'success');
                } else {
                    showNotification(`Transaction failed! Hash: ${hash}`, 'error');
                }
            }

        } catch (error: any) {
            console.error("Transaction failed:", error);
            const errorMessage = error.shortMessage || error.message || "An unknown error occurred.";
            showNotification(`Transaction failed: ${errorMessage}`, 'error', 10000);
        }
    }, [walletClient, publicClient, showNotification, chain, switchChainAsync, resolveReadCalls]);

    return { executeRead, handleTransaction, getExecutionConfig };
};
