
import React, { useState, useEffect, useRef } from 'react';
import type { Settings, VisibleButtons } from '../types';
import type { NotificationData } from './Notification';
import profilesData from '../profiles.json';

interface Profile {
  name: string;
  url: string;
}

interface SettingsViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  visibleButtons: VisibleButtons;
  setVisibleButtons: (visible: VisibleButtons) => void;
  // FIX: Updated the `showNotification` prop type to accept an optional `duration` argument for consistency with its definition in App.tsx.
  showNotification: (message: string, type: NotificationData['type'], duration?: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings, visibleButtons, setVisibleButtons, showNotification }) => {
  const [jsonText, setJsonText] = useState('');
  const profiles: Profile[] = profilesData;
  const [isProfilesLoading, setIsProfilesLoading] = useState(false);
  const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(settings, null, 2));
  }, [settings]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setProfileDropdownOpen(false);
        }
    };
    if (isProfileDropdownOpen) {
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isProfileDropdownOpen]);

  const handleLoadProfile = async (url: string) => {
    setProfileDropdownOpen(false);
    if (!window.confirm("Are you sure you want to load a new profile? This will overwrite any unsaved changes in the editor.")) {
      return;
    }
    setIsProfilesLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const profileSettings = await response.json();
      setJsonText(JSON.stringify(profileSettings, null, 2));
      showNotification('Profile loaded into editor. Click "Save" to apply.', 'info');
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      showNotification('Failed to fetch the selected profile.', 'error');
    } finally {
      setIsProfilesLoading(false);
    }
  };

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
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setProfileDropdownOpen(prev => !prev)}
                    disabled={isProfilesLoading}
                    className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors duration-200 font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-wait"
                >
                  {isProfilesLoading ? 'Loading...' : 'Load Profile'}
                </button>
                {isProfileDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-full sm:w-48 bg-gray-700 rounded-lg shadow-lg py-1 z-30 border border-gray-600 max-h-48 overflow-y-auto">
                        {profiles.length > 0 ? profiles.map(profile => (
                            <button
                                key={profile.name}
                                onClick={() => handleLoadProfile(profile.url)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 capitalize"
                            >
                                {profile.name}
                            </button>
                        )) : (
                           <p className="text-center text-gray-400 text-sm py-2">No profiles found.</p>
                        )}
                    </div>
                )}
            </div>
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