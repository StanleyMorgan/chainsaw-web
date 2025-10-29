import { useCallback } from 'react';
import { usePublicClient, useWalletClient, useAccount, useSwitchChain } from 'wagmi';
import { parseEther, formatUnits, isAddress } from 'viem';
import type { Abi, Chain } from 'viem';
import type { ButtonConfig, ReadCall } from '../types';
import type { NotificationData } from '../components/Notification';
import * as allChains from '@reown/appkit/networks';

// Create a lookup map for all known chains by their ID for efficient access.
// FIX: The original type predicate `(c): c is Chain` caused a complex type error because `Object.values(allChains)`
// includes not only Chain objects but also other exports like arrays of chains. A standard filter followed by a
// type assertion `as Chain[]` is a safer way to achieve the desired type narrowing, resolving all related errors.
const chainsById: Record<number, Chain> = Object.fromEntries(
    (Object.values(allChains)
        .filter((c) => typeof c === 'object' && c !== null && 'id' in c) as Chain[])
        .map(chain => [chain.id, chain])
);

export const useChainsawActions = (showNotification: (message: string, type: NotificationData['type'], duration?: number) => void) => {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const { chain } = useAccount();
    const { switchChainAsync } = useSwitchChain();

    const switchNetworkIfNeeded = useCallback(async (config: ButtonConfig): Promise<Chain> => {
        const targetChainId = Number(config.id);
        if (isNaN(targetChainId)) {
            throw new Error('Invalid Chain ID in button config.');
        }

        // Find a known chain or construct a custom chain object from the button config.
        let targetChain: Chain | undefined = chainsById[targetChainId];
        if (!targetChain) {
            if (config.chainName && config.rpcUrls && config.rpcUrls.length > 0 && config.nativeCurrency) {
                targetChain = {
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
                } as const satisfies Chain;
            } else {
                throw new Error(`Chain ID ${targetChainId} is not a known network, and no custom configuration was provided in the button.`);
            }
        }

        if (chain?.id === targetChainId) {
            return targetChain; // Already on the correct network
        }

        try {
            await switchChainAsync({ chainId: targetChainId });
        } catch (e: any) {
            if (e.code === 4902 || e.cause?.code === 4902) {
                try {
                    await walletClient?.addChain({ chain: targetChain });
                    // After successfully adding the chain, try to switch to it again.
                    await switchChainAsync({ chainId: targetChainId });
                } catch (addOrSwitchError: any) {
                    showNotification(`Failed to add or switch network: ${addOrSwitchError.shortMessage || addOrSwitchError.message}`, 'error');
                    throw addOrSwitchError;
                }
            } else {
                 showNotification(`Failed to switch network: ${e.shortMessage || e.message}`, 'error');
                 throw e;
            }
        }
        return targetChain;
    }, [chain, switchChainAsync, showNotification, walletClient]);

    const resolveReadCalls = useCallback(async (args: any[], parentConfig: ButtonConfig): Promise<any[]> => {
        const resolvedArgs = [];
        for (const arg of args) {
            if (arg && typeof arg === 'object' && '$read' in arg) {
                const readCall: ReadCall['$read'] = arg.$read;
                if (!publicClient) {
                    throw new Error('Public client not available for read call.');
                }
                
                try {
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
    }, [publicClient]);

    const getExecutionConfig = useCallback((config: ButtonConfig): ButtonConfig => {
        return { ...config };
    }, []);
    
    const executeRead = useCallback(async (config: ButtonConfig, args: any[]) => {
        if (!publicClient) {
            showNotification('Wallet not connected or client not ready.', 'error');
            return;
        }

        try {
            await switchNetworkIfNeeded(config);
            const resolvedArgs = args ? await resolveReadCalls(args, config) : [];

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
            const targetChain = await switchNetworkIfNeeded(config);
            
            const finalArgs = dynamicArgs || config.args || [];
            const isDeploy = !config.address || config.address === '';

            let hash;
            if (config.abi) {
                const resolvedArgs = await resolveReadCalls(finalArgs, config);

                if (isDeploy) {
                    if (!config.data) {
                        throw new Error("Deployment requires bytecode in the 'data' field.");
                    }
                    hash = await walletClient.deployContract({
                        abi: config.abi as Abi,
                        bytecode: config.data as `0x${string}`,
                        args: resolvedArgs,
                        value: parseEther(config.value || '0'),
                        account: walletClient.account,
                        chain: targetChain,
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
                        account: walletClient.account,
                        chain: targetChain,
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
                    account: walletClient.account,
                    chain: targetChain,
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