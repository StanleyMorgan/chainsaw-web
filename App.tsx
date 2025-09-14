
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { SettingsView } from './components/SettingsView';
import { Notification, NotificationData } from './components/Notification';
import type { Settings, VisibleButtons, ProfileVisibility } from './types';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount } from 'wagmi';
// FIX: Correctly import chains from 'viem/chains' as required by recent versions of wagmi and RainbowKit.
import { 
  mainnet,
  base,
  celo,
  ink,
  linea,
  lisk,
  mode,
  monadTestnet,
  optimism,
  plume,
  sei,
  somniaTestnet,
  soneium,
  superseed,
  unichain,
  worldchain
} from 'viem/chains';
// Fix: Reordered imports to potentially address a parser issue causing a false-positive error on QueryClient export.
// FIX: Split the import for QueryClient to resolve a module resolution error, importing it directly from @tanstack/query-core.
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/query-core';

// This is a public demo project ID from WalletConnect.
// For a production application, you should get your own project ID from https://cloud.walletconnect.com/
const projectId = '2b73abf5eb497019fbadec99ca8d2b8b';

const config = getDefaultConfig({
  appName: 'Chainsaw',
  appDescription: 'A web application to interact with smart contracts on different chains via a user-configured interface. Connect your wallet, configure your buttons, and execute transactions with ease.',
  appUrl: window.location.origin,
  appIcon: 'https://raw.githubusercontent.com/StanleyMorgan/Chainsaw-config/main/icons/icon128.png',
  projectId: projectId,
  chains: [
    mainnet,
    base,
    celo,
    ink,
    linea,
    lisk,
    mode,
    monadTestnet,
    optimism,
    plume,
    sei,
    somniaTestnet,
    soneium,
    superseed,
    unichain,
    worldchain
  ],
  ssr: false, // If your dApp uses server side rendering (SSR)
});

const queryClient = new QueryClient();

const PROFILE_NAMES = ['Profile 1', 'Profile 2', 'Profile 3', 'Profile 4'];

const AppContent: React.FC = () => {
  const { isConnected } = useAccount();
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [settings, setSettings] = useState<Settings>({});
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Profile state management
  const [activeProfile, setActiveProfile] = useState<string>(PROFILE_NAMES[0]);
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>({});

  const showNotification = useCallback((message: string, type: NotificationData['type'], duration: number = 5000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  }, []);

  useEffect(() => {
    if (!isConnected && view === 'settings') {
      setView('main');
      showNotification('Connect your wallet to access Settings.', 'info');
    }
  }, [isConnected, view, showNotification]);

  const handleSettingsChange = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    // When settings change (e.g., new button added), update visibility for all profiles.
    setProfileVisibility(currentProfiles => {
      const newProfiles: ProfileVisibility = {};
      for (const profileName of PROFILE_NAMES) {
        const existingProfile = currentProfiles[profileName] || {};
        const newVisibility: VisibleButtons = {};
        Object.keys(newSettings).forEach(key => {
          newVisibility[key] = existingProfile[key] !== false;
        });
        newProfiles[profileName] = newVisibility;
      }
      return newProfiles;
    });
  }, []);

  const handleSaveProfile = useCallback((profileName: string, newVisibility: VisibleButtons) => {
    setProfileVisibility(prev => ({
      ...prev,
      [profileName]: newVisibility
    }));
    showNotification(`Profile "${profileName}" saved successfully!`, 'success');
  }, [showNotification]);


  const handleReorder = (draggedKey: string, dropKey: string) => {
    const keys = Object.keys(settings);
    const draggedIndex = keys.indexOf(draggedKey);
    const dropIndex = keys.indexOf(dropKey);

    if (draggedIndex === -1 || dropIndex === -1) return;

    const [removed] = keys.splice(draggedIndex, 1);
    keys.splice(dropIndex, 0, removed);

    const newSettings: Settings = {};
    keys.forEach(key => {
        newSettings[key] = settings[key];
    });
    setSettings(newSettings);
  };

  const fetchAndSetDefaultSettings = useCallback(async (isInitialLoad = false) => {
    if (!isInitialLoad) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('https://raw.githubusercontent.com/StanleyMorgan/Chainsaw-config/main/presets/default.json');
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const defaultSettings = await response.json();
      handleSettingsChange(defaultSettings);
    } catch (error) {
      console.error("Failed to fetch or apply default settings:", error);
      showNotification('Failed to fetch default settings. Please check your internet connection.', 'error');
    } finally {
        setIsLoading(false);
    }
  }, [showNotification, handleSettingsChange]);

  useEffect(() => {
    const loadState = async () => {
        setIsLoading(true);
        try {
            const savedSettings = localStorage.getItem('chainsawSettings');
            let loadedSettings: Settings = {};

            if (savedSettings && savedSettings !== '{}') {
                loadedSettings = JSON.parse(savedSettings);
                setSettings(loadedSettings);
            } else {
                // Fetch default settings and wait for it to complete
                const response = await fetch('https://raw.githubusercontent.com/StanleyMorgan/Chainsaw-config/main/presets/default.json');
                if (!response.ok) throw new Error('Failed to fetch default settings');
                loadedSettings = await response.json();
                setSettings(loadedSettings);
            }

            const savedActiveProfile = localStorage.getItem('chainsawActiveProfile');
            setActiveProfile(savedActiveProfile || PROFILE_NAMES[0]);

            const savedProfileVisibility = localStorage.getItem('chainsawProfileVisibility');
            if (savedProfileVisibility) {
                setProfileVisibility(JSON.parse(savedProfileVisibility));
            } else {
                // Initialize profiles if they don't exist
                const initialProfiles: ProfileVisibility = {};
                for (const name of PROFILE_NAMES) {
                    const visibility: VisibleButtons = {};
                    Object.keys(loadedSettings).forEach(key => {
                        visibility[key] = true; // Default all to visible
                    });
                    initialProfiles[name] = visibility;
                }
                setProfileVisibility(initialProfiles);
            }
        } catch (error) {
            console.error("Failed to load settings, fetching default.", error);
            await fetchAndSetDefaultSettings(true);
        } finally {
            setIsLoading(false);
        }
    };
    loadState();
  }, []); // Only run on initial mount

  useEffect(() => {
    if (!isLoading && Object.keys(settings).length > 0) {
      localStorage.setItem('chainsawSettings', JSON.stringify(settings));
    }
  }, [settings, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('chainsawActiveProfile', activeProfile);
    }
  }, [activeProfile, isLoading]);

  useEffect(() => {
    if (!isLoading && Object.keys(profileVisibility).length > 0) {
      localStorage.setItem('chainsawProfileVisibility', JSON.stringify(profileVisibility));
    }
  }, [profileVisibility, isLoading]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl font-semibold animate-pulse">Loading configuration...</div>
      </div>
    );
  }

  const currentVisibleButtons = profileVisibility[activeProfile] || {};

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <Header
        currentView={view}
        setView={setView}
      />
      <main className="p-4 sm:p-6 md:p-8">
        {view === 'main' && (
          <MainView 
            settings={settings}
            setSettings={handleSettingsChange}
            visibleButtons={currentVisibleButtons}
            setVisibleButtons={() => {}} // Visibility is now managed by profiles
            buttonOrder={Object.keys(settings)}
            onReorder={handleReorder}
            showNotification={showNotification}
            activeProfile={activeProfile}
            setActiveProfile={setActiveProfile}
            profileNames={PROFILE_NAMES}
          />
        )}
        {view === 'settings' && isConnected && (
          <SettingsView
            settings={settings}
            setSettings={handleSettingsChange}
            visibleButtons={currentVisibleButtons}
            showNotification={showNotification}
            activeProfile={activeProfile}
            setActiveProfile={setActiveProfile}
            profileNames={PROFILE_NAMES}
            onSaveProfile={handleSaveProfile}
          />
        )}
      </main>
      <Notification notification={notification} setNotification={setNotification} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;