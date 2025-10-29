import { useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount, useSwitchChain } from 'wagmi';
import { parseEther, formatUnits, isAddress } from 'viem';
import type { Abi } from 'viem';
import type { ButtonConfig, ReadCall } from '../types';
import type { NotificationData } from '../components/Notification';

export const useChainsawActions = (showNotification: (message: string, type: NotificationData['type'], duration?: number) => void) => {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const { chain } = useAccount();
    const { switchChainAsync } = useSwitchChain();

    const switchNetworkIfNeeded = useCallback(async (config: ButtonConfig) => {
        const targetChainId = Number(config.id);
        if (isNaN(targetChainId)) {
            throw new Error('Invalid Chain ID in button config.');
        }

        if (chain?.id === targetChainId) {
            return; // Already on the correct network
        }

        try {
            await switchChainAsync({ chainId: targetChainId });
        } catch (e: any) {
            // Error code 4902 indicates the chain is not added to the wallet
            if (e.code === 4902 || e.cause?.code === 4902) {
                if (config.chainName && config.rpcUrls && config.rpcUrls.length > 0 && config.nativeCurrency) {
                    try {
                        // FIX: The `addChain` method expects a `chain` object parameter instead of top-level properties.
                        // Wrapped the network configuration in a `chain` object to match the `AddChainParameters` type.
                        await walletClient?.addChain({
                            chain: {
                                id: targetChainId,
                                name: config.chainName,
                                nativeCurrency: config.nativeCurrency,
                                rpcUrls: {
                                    default: { http: config.rpcUrls },
                                    public: { http: config.rpcUrls },
                                },
                                blockExplorers: config.blockExplorerUrls && config.blockExplorerUrls.length > 0 ? {
                                    default: { name: `${config.chainName} Explorer`, url: config.blockExplorerUrls[0] },
                                } : undefined,
                            }
                        });
                        showNotification(`Network "${config.chainName}" added! Please try the action again.`, 'success');
                    } catch (addError: any) {
                        showNotification(`Failed to add network: ${addError.shortMessage || addError.message}`, 'error');
                        throw addError;
                    }
                } else {
                    showNotification(`Network not found in your wallet. Please add it manually or configure it in the button settings.`, 'error');
                    throw new Error(`Chain ID ${targetChainId} not configured in wallet.`);
                }
            } else {
                 showNotification(`Failed to switch network: ${e.shortMessage || e.message}`, 'error');
            }
            throw e; // re-throw to stop execution
        }
    }, [chain, switchChainAsync, showNotification, walletClient]);

    const resolveReadCalls = useCallback(async (args: any[], parentConfig: ButtonConfig): Promise<any[]> => {
        const resolvedArgs = [];
        for (const arg of args) {
            if (arg && typeof arg === 'object' && '$read' in arg) {
                const readCall: ReadCall['$read'] = arg.$read;
                if (!publicClient) {
                    throw new Error('Public client not available for read call.');
                }
                
                if (parentConfig.id) {
                    await switchNetworkIfNeeded(parentConfig);
                }

                try {
                    // FIX: The type signature for readContract seems to require `authorizationList`.
                    // Casting to `any` to bypass what appears to be a type definition issue.
                    const data = await publicClient.readContract({
                        address: (readCall.address || parentConfig.address) as `0x${string}`,
                        abi: readCall.abi as Abi,
                        functionName: readCall.functionName,
                        args: readCall.args,
                    } as any);
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
    }, [publicClient, switchNetworkIfNeeded]);

    const getExecutionConfig = useCallback((config: ButtonConfig): ButtonConfig => {
        return { ...config };
    }, []);
    
    const executeRead = useCallback(async (config: ButtonConfig, args: any[]) => {
        if (!publicClient) {
            showNotification('Wallet not connected or client not ready.', 'error');
            return;
        }

        try {
            if (config.id) {
                await switchNetworkIfNeeded(config);
            }

            const resolvedArgs = args ? await resolveReadCalls(args, config) : [];

            // FIX: The type signature for readContract seems to require `authorizationList`.
            // Casting to `any` to bypass what appears to be a type definition issue.
            const result = await publicClient.readContract({
                address: config.address as `0x${string}`,
                abi: config.abi as Abi,
                functionName: config.functionName!,
                args: resolvedArgs,
            } as any);

            let displayResult: string;
            if (typeof result === 'bigint') {
                const decimals = (config as any).decimals ?? 18;
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
    }, [publicClient, showNotification, switchNetworkIfNeeded, resolveReadCalls]);

    const handleTransaction = useCallback(async (config: ButtonConfig, dynamicArgs?: any[]) => {
        if (!walletClient) {
            showNotification('Please connect your wallet.', 'info');
            return;
        }
        
        try {
            if (config.id) {
                await switchNetworkIfNeeded(config);
            }
            
            const finalArgs = dynamicArgs || config.args || [];
            const isDeploy = !config.address || config.address === '';

            let hash;
            if (config.abi) {
                const resolvedArgs = await resolveReadCalls(finalArgs, config);

                if (isDeploy) {
                    if (!config.data) {
                        throw new Error("Deployment requires bytecode in the 'data' field.");
                    }
                    // FIX: Added the `account` and `chain` properties, which are required by `deployContract`.
                    hash = await walletClient.deployContract({
                        abi: config.abi as Abi,
                        bytecode: config.data as `0x${string}`,
                        args: resolvedArgs,
                        value: parseEther(config.value || '0'),
                        account: walletClient.account,
                        chain: walletClient.chain,
                    });
                } else {
                    if (!isAddress(config.address)) {
                        throw new Error(`Invalid contract address: ${config.address}`);
                    }

                    // FIX: Added `account` and `chain` to the request to satisfy the type requirements from wagmi/viem.
                    const request = {
                        address: config.address as `0x${string}`,
                        abi: config.abi as Abi,
                        functionName: config.functionName!,
                        args: resolvedArgs,
                        value: parseEther(config.value || '0'),
                        gas: config.gas ? BigInt(config.gas) : undefined,
                        account: walletClient.account,
                        chain: walletClient.chain,
                    };
                    hash = await walletClient.writeContract(request);
                }
            } else if (config.data) {
                if (!isAddress(config.address)) {
                    throw new Error(`Invalid contract address: ${config.address}`);
                }
                // FIX: Casting to `any` to bypass a type error where `kzg` was unexpectedly required.
                hash = await walletClient.sendTransaction({
                    to: config.address as `0x${string}`,
                    value: parseEther(config.value || '0'),
                    data: config.data as `0x${string}`,
                    gas: config.gas ? BigInt(config.gas) : undefined,
                } as any);
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
    }, [walletClient, publicClient, showNotification, switchNetworkIfNeeded, resolveReadCalls]);

    return { executeRead, handleTransaction, getExecutionConfig };
};
