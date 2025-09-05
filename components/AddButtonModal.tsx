import React, { useState, useRef, useEffect } from 'react';
import type { NotificationData } from './Notification';
import type { Settings } from '../types';
import { AbiFunctionEncoder } from './AbiFunctionEncoder';

interface AddButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, config: any) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
  settings: Settings;
}

export const AddButtonModal: React.FC<AddButtonModalProps> = ({ isOpen, onClose, onSave, showNotification, settings }) => {
  const [jsonConfig, setJsonConfig] = useState('');
  const [isTemplateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const [isEncoderVisible, setIsEncoderVisible] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
        if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
            setTemplateDropdownOpen(false);
        }
    };
    if (isOpen && isTemplateDropdownOpen) {
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, isTemplateDropdownOpen]);

  if (!isOpen) return null;

  const handleSelectTemplate = (key: string) => {
    const templateConfig = settings[key];
    if (templateConfig) {
        const newJson = {
            [key]: { ...templateConfig }
        };
        setJsonConfig(JSON.stringify(newJson, null, 2));
    }
    setTemplateDropdownOpen(false);
  };
  
  const handleDataGenerated = (generated: { abi: any; functionName: string; args: any[] }) => {
    try {
        let currentConfig: any = {};
        let buttonKey = 'my_button_name';

        if (jsonConfig.trim()) {
             let textToParse = jsonConfig.trim();
             if (!textToParse.startsWith('{')) {
                 if (textToParse.endsWith(',')) textToParse = textToParse.slice(0, -1);
                 textToParse = `{${textToParse}}`;
             }
             const cleanedJson = textToParse.replace(/,(?=\s*[}\]])/g, '');
             const parsed = JSON.parse(cleanedJson);
             buttonKey = Object.keys(parsed)[0] || buttonKey;
             currentConfig = parsed[buttonKey] || {};
        }

        const { data, ...restOfConfig } = currentConfig;

        const updatedButtonConfig = {
            ...restOfConfig,
            abi: generated.abi,
            functionName: generated.functionName,
            args: generated.args,
        };
        
        const newJson = { [buttonKey]: updatedButtonConfig };
        setJsonConfig(JSON.stringify(newJson, null, 2));
        showNotification('ABI config inserted into JSON!', 'success');
    } catch (error) {
        console.log(error);
        showNotification('Could not update JSON. Ensure existing JSON is valid or empty.', 'error');
    }
  };

  const handleSave = () => {
    try {
      if (!jsonConfig.trim()) {
        throw new Error('JSON configuration cannot be empty.');
      }
      
      let textToParse = jsonConfig.trim();

      if (!textToParse.startsWith('{')) {
          if (textToParse.endsWith(',')) {
              textToParse = textToParse.slice(0, -1);
          }
          textToParse = `{${textToParse}}`;
      }

      const cleanedJson = textToParse.replace(/,(?=\s*[}\]])/g, '');
      const parsedJson = JSON.parse(cleanedJson);

      if (typeof parsedJson !== 'object' || parsedJson === null || Array.isArray(parsedJson)) {
        throw new Error('Configuration must be a JSON object.');
      }

      const keys = Object.keys(parsedJson);
      if (keys.length !== 1) {
        throw new Error('JSON must contain exactly one top-level key for the button name.');
      }
      
      const buttonKey = keys[0];
      const config = parsedJson[buttonKey];

      if (typeof config !== 'object' || config === null || Array.isArray(config)) {
          throw new Error('The button configuration under the key must be an object.');
      }

      const requiredKeys = ['address', 'color', 'id', 'value'];
      for (const key of requiredKeys) {
        if (!(key in config)) {
          throw new Error(`Missing required key in JSON: "${key}"`);
        }
      }
      
      const hasRawData = 'data' in config && typeof config.data === 'string';
      const hasAbiData = 'abi' in config && 'functionName' in config && 'args' in config && Array.isArray(config.args);

      if (!hasRawData && !hasAbiData) {
          throw new Error('Configuration must include either "data" or all of "abi", "functionName", and "args".');
      }

      onSave(buttonKey, config);
      onClose();
    } catch (error: any) {
      const message = error instanceof SyntaxError ? 'Invalid JSON format.' : error.message;
      showNotification(`Invalid configuration: ${message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4">
        <h2 className="text-2xl font-bold text-white">Add New Button</h2>
        
        <details className="bg-gray-900 p-2 rounded-md" onToggle={(e) => setIsEncoderVisible(e.currentTarget.open)}>
            <summary className="cursor-pointer text-blue-400 hover:text-blue-300 font-semibold select-none">
                Use ABI Function Encoder (Recommended)
            </summary>
            {isEncoderVisible && <AbiFunctionEncoder onDataGenerated={handleDataGenerated} showNotification={showNotification} />}
        </details>

        <div>
            <label htmlFor="jsonConfig" className="block text-sm font-medium text-gray-300 mb-1">
                Button Configuration JSON
            </label>
            <textarea
                id="jsonConfig"
                value={jsonConfig}
                onChange={(e) => setJsonConfig(e.target.value)}
                className="w-full h-64 p-4 bg-gray-900 text-gray-200 font-mono rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                spellCheck="false"
                placeholder={`{
  "my_button_name": {
    "address": "0x...",
    "color": "#6B2A9D",
    "id": 1,
    "value": "0",
    "description": "A short description.",
    "abi": [...],
    "functionName": "myFunction",
    "args": [...]
  }
}`}
            />
        </div>

        <div className="flex items-center justify-between">
          <div className="relative" ref={templateDropdownRef}>
            <button
              onClick={() => setTemplateDropdownOpen(prev => !prev)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              aria-haspopup="true"
              aria-expanded={isTemplateDropdownOpen}
            >
              Template
            </button>
            {isTemplateDropdownOpen && Object.keys(settings).length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-700 rounded-lg shadow-lg py-1 z-30 border border-gray-600 max-h-48 overflow-y-auto">
                {Object.keys(settings).map(key => (
                  <button
                    key={key}
                    onClick={() => handleSelectTemplate(key)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 capitalize"
                  >
                    {key}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};