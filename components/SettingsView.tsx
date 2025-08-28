
import React, { useState, useEffect } from 'react';
import type { Settings, VisibleButtons } from '../types';
import type { NotificationData } from './Notification';

interface SettingsViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  visibleButtons: VisibleButtons;
  setVisibleButtons: (visible: VisibleButtons) => void;
  showNotification: (message: string, type: NotificationData['type']) => void;
  onReset: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings, visibleButtons, setVisibleButtons, showNotification, onReset }) => {
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    setJsonText(JSON.stringify(settings, null, 2));
  }, [settings]);

  const handleSave = () => {
    try {
      const newSettings = JSON.parse(jsonText);
      if (typeof newSettings !== 'object' || newSettings === null || Array.isArray(newSettings)) {
        throw new Error("Invalid JSON format. Must be an object.");
      }
      setSettings(newSettings);
      
      const newVisibility: VisibleButtons = {};
      Object.keys(newSettings).forEach(key => {
        newVisibility[key] = visibleButtons[key] !== false;
      });
      setVisibleButtons(newVisibility);

      showNotification('Settings saved successfully!', 'success');
    } catch (error: any) {
      console.error(error);
      showNotification(`Invalid JSON: ${error.message}`, 'error');
    }
  };
  
  const handleVisibilityChange = (key: string, isVisible: boolean) => {
    setVisibleButtons({
      ...visibleButtons,
      [key]: isVisible,
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold mb-4">Button Visibility</h2>
        <div className="bg-gray-800 p-6 rounded-lg grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Object.keys(settings).length > 0 ? (
            Object.keys(settings).map((key) => (
            <label key={key} className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-gray-700">
              <input
                type="checkbox"
                checked={visibleButtons[key] ?? true}
                onChange={(e) => handleVisibilityChange(key, e.target.checked)}
                className="h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-200 capitalize select-none">{key}</span>
            </label>
          ))) : (
            <p className="text-gray-400 col-span-full">No buttons configured. Add some in the JSON editor below.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Button Configuration (JSON)</h2>
        <div className="bg-gray-800 p-4 rounded-lg">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full h-96 p-4 bg-gray-900 text-gray-200 font-mono rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            spellCheck="false"
          />
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <button
              onClick={onReset}
              className="w-full sm:w-auto bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 transition-colors duration-200 font-semibold"
            >
              Reset to Default
            </button>
            <button
              onClick={handleSave}
              className="w-full sm:flex-1 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors duration-200 font-semibold text-lg order-first sm:order-last"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};