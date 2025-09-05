import React, { useState, useMemo, useEffect } from 'react';
import { Abi, AbiFunction } from 'viem';
import type { NotificationData } from './Notification';

interface AbiFunctionEncoderProps {
  onDataGenerated: (data: { abi: any; functionName: string; args: any[] }) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
}

export const AbiFunctionEncoder: React.FC<AbiFunctionEncoderProps> = ({ onDataGenerated, showNotification }) => {
    const [abiString, setAbiString] = useState('');
    const [selectedFunctionName, setSelectedFunctionName] = useState('');
    const [argValues, setArgValues] = useState<string[]>([]);

    const { functions, error: abiError } = useMemo(() => {
        if (!abiString.trim()) {
            return { functions: [], error: null };
        }
        try {
            const parsedAbi = JSON.parse(abiString) as Abi;
            const funcs = parsedAbi.filter(
                (item): item is AbiFunction => 
                    item.type === 'function' && 
                    (item.stateMutability === 'payable' || item.stateMutability === 'nonpayable')
            );
             if (funcs.length === 0) {
                return { functions: [], error: 'No writable functions found in ABI.' };
            }
            return { functions: funcs, error: null };
        } catch (e) {
            return { functions: [], error: 'Invalid ABI JSON format.' };
        }
    }, [abiString]);

    const selectedFunction = useMemo(() => {
        return functions.find(f => f.name === selectedFunctionName);
    }, [functions, selectedFunctionName]);

    useEffect(() => {
        if (selectedFunction) {
            setArgValues(new Array(selectedFunction.inputs.length).fill(''));
        } else {
            setArgValues([]);
            setSelectedFunctionName('');
        }
    }, [selectedFunction, functions]);
    
    useEffect(() => {
        if (functions.length > 0 && !functions.find(f => f.name === selectedFunctionName)) {
            setSelectedFunctionName(functions[0].name);
        }
    }, [functions, selectedFunctionName]);

    const handleArgChange = (index: number, value: string) => {
        const newArgs = [...argValues];
        newArgs[index] = value;
        setArgValues(newArgs);
    };

    const handleGenerate = () => {
        if (!selectedFunction || !abiString) {
            showNotification('Please provide a valid ABI and select a function.', 'error');
            return;
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
                        return arrayValue;
                    } catch {
                        throw new Error(`Argument "${input.name}" must be a valid JSON array string (e.g., ["a", "b"] or [1, 2]).`);
                    }
                }
                 if (input.type.startsWith('uint') || input.type.startsWith('int')) {
                    // viem handles string representations of numbers, including BigInts
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

            onDataGenerated({
                abi: JSON.parse(abiString),
                functionName: selectedFunction.name,
                args: processedArgs,
            });
        } catch (e: any) {
            showNotification(`Error processing arguments: ${e.message}`, 'error');
        }
    };

    return (
        <div className="bg-gray-700 p-4 rounded-md mt-2 space-y-4">
            <div>
                <label htmlFor="abi-input" className="block text-sm font-medium text-gray-300 mb-1">Contract ABI</label>
                <textarea
                    id="abi-input"
                    value={abiString}
                    onChange={(e) => setAbiString(e.target.value)}
                    className="w-full h-24 p-2 bg-gray-800 text-gray-200 font-mono rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
                    placeholder="Paste contract ABI here..."
                />
                {abiError && <p className="text-red-400 text-xs mt-1">{abiError}</p>}
            </div>

            {functions.length > 0 && (
                <>
                    <div>
                        <label htmlFor="function-select" className="block text-sm font-medium text-gray-300 mb-1">Function</label>
                        <select
                            id="function-select"
                            value={selectedFunctionName}
                            onChange={(e) => setSelectedFunctionName(e.target.value)}
                            className="w-full p-2 bg-gray-800 text-gray-200 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="" disabled>Select a function</option>
                            {functions.map(func => (
                                <option key={func.name} value={func.name}>{func.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedFunction && selectedFunction.inputs.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-300">Arguments</h4>
                            {selectedFunction.inputs.map((input, index) => (
                                <div key={index}>
                                    <label htmlFor={`arg-${index}`} className="block text-xs font-medium text-gray-400 capitalize">
                                        {input.name} ({input.type})
                                    </label>
                                    <input
                                        id={`arg-${index}`}
                                        type="text"
                                        value={argValues[index] || ''}
                                        onChange={(e) => handleArgChange(index, e.target.value)}
                                        className="w-full mt-1 p-2 bg-gray-800 text-gray-200 font-mono rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                        placeholder={input.type.endsWith('[]') ? 'e.g., ["0x123...", "0xabc..."]' : input.type}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <button
                      onClick={handleGenerate}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors duration-200 font-semibold"
                    >
                      Generate & Update JSON
                    </button>
                </>
            )}
        </div>
    );
};