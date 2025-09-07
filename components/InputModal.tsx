import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { ButtonConfig } from '../types';
import type { NotificationData } from './Notification';
import type { Abi, AbiFunction, AbiParameter } from 'viem';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ButtonConfig | null;
  onSubmit: (args: any[]) => void;
  onSave: (args: any[]) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
}

// Helper to get a value from a nested object/array using a path
const getDeep = (obj: any, path: (string | number)[]): any => {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

// Helper to create an immutable copy with a deeply set value
const updateDeep = (current: any, path: (string | number)[], value: any): any => {
    if (path.length === 0) {
        return value;
    }
    const [head, ...tail] = path;
    const newCurrent = Array.isArray(current) ? [...current] : { ...current };

    newCurrent[head as any] = updateDeep(newCurrent[head as any], tail, value);
    return newCurrent;
};

// Determines if a saved value should be considered empty and require user input.
const isValueEmpty = (value: any): boolean => {
    return value == null || value === '';
};

export const InputModal: React.FC<InputModalProps> = ({ isOpen, onClose, config, onSubmit, onSave, showNotification }) => {
    const [argValues, setArgValues] = useState<any[]>([]);

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

    const processArgs = useCallback((valuesToProcess: any[]): any[] | null => {
        if (!selectedFunction) {
            showNotification('Could not determine function from ABI.', 'error');
            return null;
        }

        const convertValue = (abiDef: AbiParameter, value: any): any => {
            const trimmedValue = typeof value === 'string' ? value.trim() : value;
            if (trimmedValue === undefined || trimmedValue === null || trimmedValue === '') {
                throw new Error(`Argument "${abiDef.name || ''}" cannot be empty.`);
            }

            if (abiDef.type === 'tuple') {
                const tupleObject: { [key: string]: any } = {};
                for (const component of ((abiDef as { components: readonly AbiParameter[] }).components)) {
                    if (!component.name) throw new Error("A tuple component in the ABI is missing a name.");
                    tupleObject[component.name] = convertValue(component, value[component.name]);
                }
                return tupleObject;
            }

            if (abiDef.type.endsWith('[]')) {
                try {
                    const arrayValue = JSON.parse(trimmedValue);
                    if (!Array.isArray(arrayValue)) throw new Error();
                    const baseType = abiDef.type.slice(0, -2);
                    if (baseType.startsWith('uint') || baseType.startsWith('int')) {
                        return arrayValue.map(item => BigInt(item).toString());
                    }
                    return arrayValue;
                } catch {
                    throw new Error(`Argument "${abiDef.name}" must be a valid JSON array string (e.g., ["a", "b"] or [1, 2]).`);
                }
            }
             if (abiDef.type.startsWith('uint') || abiDef.type.startsWith('int')) {
                return BigInt(trimmedValue).toString();
            }
            if (abiDef.type === 'bool') {
                const lowerValue = String(trimmedValue).toLowerCase();
                if (lowerValue !== 'true' && lowerValue !== 'false') {
                     throw new Error(`Argument "${abiDef.name}" must be "true" or "false".`);
                }
                return lowerValue === 'true';
            }
            return trimmedValue;
        };
        
        try {
            return selectedFunction.inputs.map((input, index) => convertValue(input, valuesToProcess[index]));
        } catch (e: any) {
            showNotification(`Error: ${e.message}`, 'error');
            return null;
        }
    }, [selectedFunction, showNotification]);
    
    useEffect(() => {
        if (selectedFunction) {
            try {
                const createDefaultValue = (input: AbiParameter): any => {
                    if (input.type === 'tuple') {
                        const tupleObj: { [key: string]: any } = {};
                        ((input as { components: readonly AbiParameter[] }).components).forEach((component) => {
                            if (!component.name) throw new Error("A tuple component in the ABI is missing a name.");
                            tupleObj[component.name] = createDefaultValue(component);
                        });
                        return tupleObj;
                    }
                    return '';
                };
                
                const formatSavedArgsForUI = (inputs: readonly AbiParameter[], args: any[]): any[] => {
                    return args.map((arg, index) => {
                        const input = inputs[index];
                        if (input.type === 'tuple' && typeof arg === 'object' && arg !== null) {
                             const formattedTuple: { [key: string]: any } = {};
                             ((input as { components: readonly AbiParameter[] }).components).forEach((component) => {
                                if (!component.name) throw new Error("A tuple component in the ABI is missing a name.");
                                formattedTuple[component.name] = formatSavedArgsForUI([component], [arg[component.name]])[0];
                             });
                             return formattedTuple;
                        }
                        if (typeof arg === 'object' && arg !== null) {
                            return JSON.stringify(arg);
                        }
                        return String(arg ?? '');
                    });
                };

                if (config?.args && config.args.length === selectedFunction.inputs.length) {
                    setArgValues(formatSavedArgsForUI(selectedFunction.inputs, config.args));
                } else {
                    setArgValues(selectedFunction.inputs.map(createDefaultValue));
                }
            } catch (e: any) {
                showNotification(`ABI Error: ${e.message}`, 'error');
                onClose();
            }
        }
    }, [selectedFunction, config, showNotification, onClose]);
    
    const handleArgChange = (path: (string | number)[], value: string) => {
        setArgValues(prev => updateDeep(prev, path, value));
    };

    const handleSubmit = () => {
        const processedArgs = processArgs(argValues);
        if (processedArgs) {
            onSubmit(processedArgs);
        }
    };

    const checkVisibleInputs = useCallback((
        inputs: readonly AbiParameter[], 
        argsSource: any[] | undefined,
        pathPrefix: (string | number)[], 
        isTupleComponent: boolean
    ): AbiParameter[] => {
        let visible: AbiParameter[] = [];
        inputs.forEach((input, index) => {
            const currentSegment = isTupleComponent ? input.name : index;
            if (isTupleComponent && currentSegment === undefined) {
                console.error("Malformed ABI: tuple component is missing a name. Cannot determine visibility.", input);
                return;
            }
            
            const path = [...pathPrefix, currentSegment!];
            
            if (input.type === 'tuple') {
                const visibleChildren = checkVisibleInputs((input as { components: readonly AbiParameter[] }).components, argsSource, path, true);
                if (visibleChildren.length > 0) {
                    visible.push(input);
                }
            } else {
                const value = getDeep(argsSource, path);
                if (isValueEmpty(value)) {
                    visible.push(input);
                }
            }
        });
        return visible;
    }, []);

    const handleSave = () => {
        onSave(argValues);
        showNotification('Inputs saved as default for this button.', 'success');
        
        if (selectedFunction) {
            // Check if the values we just saved fill all the required inputs
            const visibleAfterSave = checkVisibleInputs(selectedFunction.inputs, argValues, [], false);
            if (visibleAfterSave.length === 0) {
                // If the form is now complete, just close the modal without submitting.
                onClose();
            }
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

    useEffect(() => {
        if (isOpen && selectedFunction && config) {
            const visible = checkVisibleInputs(selectedFunction.inputs, config.args, [], false);
            if (visible.length === 0) {
                 // All fields are pre-filled, so we can submit automatically.
                 // We use the saved args from config, not the UI state.
                const processedArgs = processArgs(config.args || []);
                if (processedArgs) {
                    onSubmit(processedArgs);
                } else {
                    // If processing fails, it's safer to close the modal
                    // than to get stuck in a loop. A notification will be shown.
                    onClose();
                }
            }
        }
    }, [isOpen, selectedFunction, config, checkVisibleInputs, processArgs, onSubmit, onClose]);


    const renderInputFields = (inputs: readonly AbiParameter[], pathPrefix: (string | number)[], isTupleComponent: boolean): (React.ReactElement | null)[] => {
        return inputs.map((input, index) => {
            const currentSegment = isTupleComponent ? input.name : index;
            if (currentSegment === undefined) {
                console.error("Malformed ABI: tuple component is missing a name. Cannot render input.", input);
                return null;
            }
            
            const path = [...pathPrefix, currentSegment];
            
            if (input.type === 'tuple') {
                const components = (input as { components: readonly AbiParameter[] }).components;
                const childFields = renderInputFields(components, path, true).filter(Boolean);

                if (childFields.length > 0) {
                    return (
                        <fieldset key={path.join('.')} className="border border-gray-600 p-3 rounded-md space-y-3">
                            <legend className="px-2 text-sm font-medium text-gray-300 capitalize">
                                {input.name} <span className="text-gray-400 font-mono text-xs">({input.type})</span>
                            </legend>
                            {childFields}
                        </fieldset>
                    );
                }
                return null;
            }
            
            const savedValue = getDeep(config?.args, path);
            if (!isValueEmpty(savedValue)) {
                return null; // Don't render pre-filled fields
            }

            const value = getDeep(argValues, path);

            return (
                <div key={path.join('.')}>
                    <label htmlFor={`arg-${path.join('-')}`} className="block text-sm font-medium text-gray-300 capitalize">
                        {input.name} <span className="text-gray-400 font-mono text-xs">({input.type})</span>
                    </label>
                    <input
                        id={`arg-${path.join('-')}`}
                        type="text"
                        value={value ?? ''}
                        onChange={(e) => handleArgChange(path, e.target.value)}
                        className="w-full mt-1 p-2 bg-gray-900 text-gray-200 font-mono rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder={getPlaceholderText(input.type)}
                    />
                </div>
            );
        });
    };

    if (!isOpen || !config || !selectedFunction) {
        return null;
    }
    
    const renderedFields = renderInputFields(selectedFunction.inputs, [], false).filter(Boolean);

    if (renderedFields.length === 0 && isOpen) {
        // This handles the case where the modal might briefly flash before auto-submitting.
        // Or if for some reason auto-submit fails, it ensures we don't show an empty modal.
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
                <h2 className="text-2xl font-bold text-blue-400 font-mono">
                    {selectedFunction.name}
                </h2>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto p-4">
                   {renderedFields}
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