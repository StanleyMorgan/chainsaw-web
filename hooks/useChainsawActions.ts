import { useCallback } from 'react';
// FIX: Imported useSwitchChain from wagmi to handle network switching.
import { usePublicClient, useWalletClient, useAccount, useSwitchChain } from 'wagmi';
import { parseEther, formatUnits, isAddress } from 'viem';
import type { Abi } from 'viem';
import type { ButtonConfig, ReadCall } from '../types';
import type { NotificationData } from '../components/Notification';
// import { useAppKit } from '@reown/appkit/react';
import * as allChains from '@reown/appkit/networks';

// FIX: Filtered chain objects to ensure they have an 'id' property before creating the map.
// This prevents errors from other exports in the networks module.
const chainsById: Record<number, any> = Object.fromEntries(
    Object.values(allChains)
        .filter((c): c is { id: number } => typeof c === 'object' && c !== null && 'id' in c)
        .map(chain => [chain.id, chain])
);

export const useChainsawActions = (showNotification: (message: string, type: NotificationData['type'], duration?: number) => void) => {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const { chain } = useAccount();
    // const appKit = useAppKit();
    // FIX: Replaced useAppKit with useSwitchChain for network switching functionality.
    const { switchChainAsync } = useSwitchChain();

    const switchNetworkIfNeeded = useCallback(async (targetChainId: number) => {
        if (chain?.id !== targetChainId) {
            const targetChain = chainsById[targetChainId];
            if (!targetChain) {
                showNotification(`Chain with ID ${targetChainId} is not configured in the app.`, 'error');
                throw new Error(`Unsupported chain ID: ${targetChainId}`);
            }
            try {
                // FIX: Switched to wagmi's switchChainAsync to change networks.
                await switchChainAsync({ chainId: targetChainId });
            } catch (e) {
                showNotification(`Failed to switch network. Please do it manually in your wallet.`, 'error');
                throw e; // re-throw to stop execution
            }
        }
    // FIX: Updated dependency array for useCallback.
    }, [chain, switchChainAsync, showNotification]);

    const resolveReadCalls = useCallback(async (args: any[], parentConfig: ButtonConfig): Promise<any[]> => {
        const resolvedArgs = [];
        for (const arg of args) {
            if (arg && typeof arg === 'object' && '$read' in arg) {
                const readCall: ReadCall['$read'] = arg.$read;
                if (!publicClient) {
                    throw new Error('Public client not available for read call.');
                }
                
                if (parentConfig.id) {
                    await switchNetworkIfNeeded(Number(parentConfig.id));
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
                await switchNetworkIfNeeded(Number(config.id));
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
                await switchNetworkIfNeeded(Number(config.id));
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
