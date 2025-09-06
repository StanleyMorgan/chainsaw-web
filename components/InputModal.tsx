import React, { useState, useMemo, useEffect } from 'react';
import type { ButtonConfig } from '../types';
import type { NotificationData } from './Notification';
import type { Abi, AbiFunction } from 'viem';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ButtonConfig | null;
  onSubmit: (args: any[]) => void;
  onSave: (args: any[]) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
}

export const InputModal: React.FC<InputModalProps> = ({ isOpen, onClose, config, onSubmit, onSave, showNotification }) => {
    const [argValues, setArgValues] = useState<string[]>([]);

    const selectedFunction = useMemo(() => {
        if (!config || !config.abi) return null;
        try {
            const abi = (typeof config.abi === 'string' ? JSON.parse(config.abi) : config.abi) as Abi;
            let functionName = config.functionName;

            const functionsInAbi = abi.filter((item): item is AbiFunction => item.type === 'function');
            if (!functionName) {
                if (functionsInAbi.length === 1) {
                    functionName = functionsInAbi[0].name;
                }
            }
            return functionsInAbi.find(f => f.name === functionName) || null;
        } catch {
            return null;
        }
    }, [config]);

    useEffect(() => {
        if (selectedFunction) {
            if (config?.args && config.args.length === selectedFunction.inputs.length) {
                const initialArgs = config.args.map(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                        return JSON.stringify(arg);
                    }
                    return String(arg);
                });
                setArgValues(initialArgs);
            } else {
                setArgValues(new Array(selectedFunction.inputs.length).fill(''));
            }
        }
    }, [selectedFunction, config]);

    const handleArgChange = (index: number, value: string) => {
        const newArgs = [...argValues];
        newArgs[index] = value;
        setArgValues(newArgs);
    };
    
    const processArgs = (): any[] | null => {
        if (!selectedFunction) {
            showNotification('Could not determine function from ABI.', 'error');
            return null;
        }
        try {
            const processedArgs = selectedFunction.inputs.map((input, index) => {
                const value = argValues[index];
                if (value === undefined || value === null || value === '') {
                    throw new Error(`Argument "${input.name || `index ${index}`}" cannot be empty.`);
                }

                if (input.type.endsWith('[]')) {
                    try {
                        const arrayValue = JSON.parse(value);
                        if (!Array.isArray(arrayValue)) throw new Error();
                        // viem can handle numeric strings in arrays for BigInts
                        return arrayValue.map(item => typeof item === 'number' ? BigInt(item).toString() : item);
                    } catch {
                        throw new Error(`Argument "${input.name}" must be a valid JSON array string (e.g., ["a", "b"] or [1, 2]).`);
                    }
                }
                 if (input.type.startsWith('uint') || input.type.startsWith('int')) {
                    // This is the fix: return a string, not a BigInt object.
                    // This makes the args array JSON-serializable.
                    // viem correctly handles string representations for numeric types.
                    return BigInt(value).toString();
                }
                if (input.type === 'bool') {
                    const lowerValue = value.toLowerCase();
                    if (lowerValue !== 'true' && lowerValue !== 'false') {
                         throw new Error(`Argument "${input.name}" must be "true" or "false".`);
                    }
                    return lowerValue === 'true';
                }
                return value;
            });
            return processedArgs;
        } catch (e: any) {
            showNotification(`Error: ${e.message}`, 'error');
            return null;
        }
    };

    const handleSubmit = () => {
        const processedArgs = processArgs();
        if (processedArgs) {
            onSubmit(processedArgs);
        }
    };

    const handleSave = () => {
        const processedArgs = processArgs();
        if (processedArgs) {
            onSave(processedArgs);
            showNotification('Inputs saved as default for this button.', 'success');
        }
    };
    
    const getPlaceholderText = (type: string): string => {
        if (type === 'string[]') {
            return 'e.g., ["abcd", "efgh"]';
        }
        if (type.endsWith('[]')) {
            return 'e.g., ["0x123...", "0xabc..."]';
        }
        return type;
    };

    if (!isOpen || !config || !selectedFunction) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
                <h2 className="text-2xl font-bold text-blue-400 font-mono">
                    {selectedFunction.name}
                </h2>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {selectedFunction.inputs.map((input, index) => (
                        <div key={index}>
                            <label htmlFor={`arg-${index}`} className="block text-sm font-medium text-gray-300 capitalize">
                                {input.name} <span className="text-gray-400 font-mono text-xs">({input.type})</span>
                            </label>
                            <input
                                id={`arg-${index}`}
                                type="text"
                                value={argValues[index] || ''}
                                onChange={(e) => handleArgChange(index, e.target.value)}
                                className="w-full mt-1 p-2 bg-gray-900 text-gray-200 font-mono rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder={getPlaceholderText(input.type)}
                            />
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Save
                    </button>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};