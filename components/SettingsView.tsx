
import React, { useState, useEffect, useRef } from 'react';
import type { Settings, VisibleButtons } from '../types';
import type { NotificationData } from './Notification';
import presetsData from '../presets.json';
import { ChevronDownIcon } from './icons';

interface Preset {
  name: string;
  url: string;
}

interface SettingsViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  visibleButtons: VisibleButtons;
  showNotification: (message: string, type: NotificationData['type'], duration?: number) => void;
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  profileNames: string[];
  onSaveProfile: (profileName: string, newVisibility: VisibleButtons) => void;
}

const ProfileSelector: React.FC<{
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  profileNames: string[];
}> = ({ activeProfile, setActiveProfile, profileNames }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelectProfile = (profileName: string) => {
    setActiveProfile(profileName);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full bg-gray-700 text-white rounded-md py-3 px-4 shadow-lg hover:bg-gray-600 transition-colors duration-200 flex items-center justify-between font-semibold"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="font-bold">{activeProfile}</span>
        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-full bg-gray-700 rounded-lg shadow-lg py-1 z-20 border border-gray-600 max-h-48 overflow-y-auto">
          {profileNames.map(name => (
            <button
              key={name}
              onClick={() => handleSelectProfile(name)}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


export const SettingsView: React.FC<SettingsViewProps> = ({ 
  settings, 
  setSettings, 
  visibleButtons, 
  showNotification,
  activeProfile,
  setActiveProfile,
  profileNames,
  onSaveProfile
}) => {
  const [jsonText, setJsonText] = useState('');
  const [draftVisibility, setDraftVisibility] = useState<VisibleButtons>({});
  const presets: Preset[] = presetsData;
  const [isPresetsLoading, setIsPresetsLoading] = useState(false);
  const [isPresetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [pendingPresetUrl, setPendingPresetUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(settings, null, 2));
  }, [settings]);

  useEffect(() => {
    // Sync draft visibility when the active profile changes or initial data loads
    setDraftVisibility(visibleButtons);
  }, [visibleButtons, activeProfile]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setPresetDropdownOpen(false);
        }
    };
    if (isPresetDropdownOpen) {
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isPresetDropdownOpen]);

  const handleLoadPresetClick = (url: string) => {
    setPresetDropdownOpen(false);
    setPendingPresetUrl(url);
  };
  
  const executeLoadPreset = async (url: string, mode: 'replace' | 'merge') => {
    setPendingPresetUrl(null);
    setIsPresetsLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const presetSettings = await response.json();

      if (mode === 'replace') {
        setJsonText(JSON.stringify(presetSettings, null, 2));
        showNotification('Preset loaded. Click "Save Configuration" to apply.', 'info');
      } else { // Merge logic
        let currentSettings: Settings = {};
        try {
          currentSettings = JSON.parse(jsonText);
          if (typeof currentSettings !== 'object' || currentSettings === null || Array.isArray(currentSettings)) {
            throw new Error("Current configuration is not a valid JSON object.");
          }
        } catch (e) {
          showNotification('Cannot merge: Current configuration is not valid JSON.', 'error');
          return;
        }

        const newSettings = { ...currentSettings };
        let mergedCount = 0;
        Object.keys(presetSettings).forEach(key => {
          if (!newSettings.hasOwnProperty(key)) {
            newSettings[key] = presetSettings[key];
            mergedCount++;
          }
        });

        setJsonText(JSON.stringify(newSettings, null, 2));
        if (mergedCount > 0) {
            showNotification(`${mergedCount} new button(s) merged. Click "Save Configuration" to apply.`, 'success');
        } else {
            showNotification('No new buttons to merge. Your configuration is up to date.', 'info');
        }
      }

    } catch (error) {
      console.error("Failed to fetch or process preset:", error);
      showNotification('Failed to process the selected preset.', 'error');
    } finally {
      setIsPresetsLoading(false);
    }
  };

  const handleSaveConfiguration = () => {
    try {
      const newSettings = JSON.parse(jsonText);
      if (typeof newSettings !== 'object' || newSettings === null || Array.isArray(newSettings)) {
        throw new Error("Invalid JSON format. Must be an object.");
      }
      setSettings(newSettings);
      showNotification('Settings saved successfully! New visibility defaults applied.', 'success');
    } catch (error: any) {
      console.error(error);
      showNotification(`Invalid JSON: ${error.message}`, 'error');
    }
  };
  
  const handleVisibilityChange = (key: string, isVisible: boolean) => {
    setDraftVisibility(prev => ({
      ...prev,
      [key]: isVisible,
    }));
  };

  const handleSaveProfileClick = () => {
    onSaveProfile(activeProfile, draftVisibility);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold mb-4">Button Visibility</h2>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Object.keys(settings).length > 0 ? (
              Object.keys(settings).map((key) => (
              <label key={key} className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={draftVisibility[key] ?? true}
                  onChange={(e) => handleVisibilityChange(key, e.target.checked)}
                  className="h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-gray-200 capitalize select-none">{key}</span>
              </label>
            ))) : (
              <p className="text-gray-400 col-span-full">No buttons configured. Add some in the JSON editor below.</p>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2">
                <ProfileSelector 
                    activeProfile={activeProfile}
                    setActiveProfile={setActiveProfile}
                    profileNames={profileNames}
                />
              </div>
              <div className="w-full sm:w-1/2">
                <button
                    onClick={handleSaveProfileClick}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors duration-200 font-semibold"
                >
                    Save Profile
                </button>
              </div>
            </div>
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
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setPresetDropdownOpen(prev => !prev)}
                    disabled={isPresetsLoading}
                    className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors duration-200 font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-wait"
                >
                  {isPresetsLoading ? 'Loading...' : 'Load Preset'}
                </button>
                {isPresetDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-full sm:w-48 bg-gray-700 rounded-lg shadow-lg py-1 z-30 border border-gray-600 max-h-48 overflow-y-auto">
                        {presets.length > 0 ? presets.map(preset => (
                            <button
                                key={preset.name}
                                onClick={() => handleLoadPresetClick(preset.url)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 capitalize"
                            >
                                {preset.name}
                            </button>
                        )) : (
                           <p className="text-center text-gray-400 text-sm py-2">No presets found.</p>
                        )}
                    </div>
                )}
            </div>
            <button
              onClick={handleSaveConfiguration}
              className="w-full sm:flex-1 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors duration-200 font-semibold text-lg order-first sm:order-last"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
      
      {pendingPresetUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 border border-gray-700">
            <h2 className="text-xl font-bold text-white">Load Preset</h2>
            <p className="text-gray-300">How would you like to load this preset?</p>
            <div className="space-y-3 text-left">
                <div className="p-3 bg-gray-900 rounded-md border border-gray-700">
                    <p className="text-md font-semibold text-blue-400">Replace</p>
                    <p className="text-sm text-gray-400 mt-1">Overwrite your current configuration in the editor.</p>
                </div>
                <div className="p-3 bg-gray-900 rounded-md border border-gray-700">
                    <p className="text-md font-semibold text-indigo-400">Merge</p>
                    <p className="text-sm text-gray-400 mt-1">Add new buttons from the preset without overwriting your existing ones.</p>
                </div>
            </div>
            <div className="flex justify-end gap-4 pt-2">
              <button
                onClick={() => setPendingPresetUrl(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                disabled={isPresetsLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => executeLoadPreset(pendingPresetUrl, 'merge')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                disabled={isPresetsLoading}
              >
                Merge
              </button>
              <button
                onClick={() => executeLoadPreset(pendingPresetUrl, 'replace')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                disabled={isPresetsLoading}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
