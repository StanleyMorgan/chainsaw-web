
import React, { useState } from 'react';
import type { NotificationData } from './Notification';

interface AddButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, config: any) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
}

export const AddButtonModal: React.FC<AddButtonModalProps> = ({ isOpen, onClose, onSave, showNotification }) => {
  const [jsonConfig, setJsonConfig] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      if (!jsonConfig.trim()) {
        throw new Error('JSON configuration cannot be empty.');
      }
      const parsedJson = JSON.parse(jsonConfig);

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

      const requiredKeys = ['address', 'color', 'data', 'gas', 'id', 'value'];
      for (const key of requiredKeys) {
        if (!(key in config)) {
          throw new Error(`Missing required key in JSON: "${key}"`);
        }
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
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold text-white">Add New Button</h2>
        
        <div>
            <label htmlFor="jsonConfig" className="block text-sm font-medium text-gray-300 mb-1">
                Configuration JSON
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
    "data": "0x...",
    "gas": "0x14F60",
    "id": 1,
    "value": "0x0",
    "description": "A short description."
  }
}`}
            />
        </div>

        <div className="flex justify-end gap-4">
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
  );
};
