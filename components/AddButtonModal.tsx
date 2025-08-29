
import React, { useState } from 'react';
import type { NotificationData } from './Notification';

interface AddButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, config: any) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
}

export const AddButtonModal: React.FC<AddButtonModalProps> = ({ isOpen, onClose, onSave, showNotification }) => {
  const [buttonKey, setButtonKey] = useState('');
  const [jsonConfig, setJsonConfig] = useState(`{
  "address": "0x...",
  "color": "#6B2A9D",
  "data": "0x...",
  "gas": "0x14F60",
  "id": 57073,
  "value": "0x0",
  "description": "A short description of this action."
}`);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!buttonKey.trim()) {
      showNotification('Button name cannot be empty.', 'error');
      return;
    }

    try {
      const config = JSON.parse(jsonConfig);
      // Basic validation for required keys
      const requiredKeys = ['address', 'color', 'data', 'gas', 'id', 'value'];
      for (const key of requiredKeys) {
        if (!(key in config)) {
          throw new Error(`Missing required key in JSON: "${key}"`);
        }
      }
      onSave(buttonKey.trim(), config);
      onClose();
    } catch (error: any) {
      showNotification(`Invalid JSON configuration: ${error.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold text-white">Add / Edit Button</h2>
        
        <div>
          <label htmlFor="buttonKey" className="block text-sm font-medium text-gray-300 mb-1">
            Button Name (e.g., "ink_gm")
          </label>
          <input
            id="buttonKey"
            type="text"
            value={buttonKey}
            onChange={(e) => setButtonKey(e.target.value)}
            placeholder="Enter a unique name"
            className="w-full p-2 bg-gray-900 text-gray-200 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        
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
