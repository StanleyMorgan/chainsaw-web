import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { SettingsView } from './components/SettingsView';
import { Notification, NotificationData } from './components/Notification';
import type { Settings, VisibleButtons, ProfileVisibility } from './types';

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { WagmiProvider, useAccount, type Chain } from 'wagmi';
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
} from '@reown/appkit/networks';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/query-core';

// 1. Get projectId from https://cloud.walletconnect.com
// FIX: Removed `as any` type assertion now that `import.meta.env` is properly typed.
const projectId = import.meta.env.VITE_PROJECT_ID;

// 2. Create wagmiConfig
const metadata = {
  name: 'Chainsaw',
  description: 'A web application to interact with smart contracts on different chains via a user-configured interface. Connect your wallet, configure your buttons, and execute transactions with ease.',
  url: window.location.origin,
  icons: ['https://raw.githubusercontent.com/StanleyMorgan/Chainsaw-config/main/icons/icon128.png']
};

// FIX: Replaced the specific `typeof mainnet` with the generic `Chain` type from `wagmi`. This resolves an error where TypeScript enforced `mainnet`'s literal types (e.g., block explorer name) onto all other networks, causing a type mismatch.
type AppKitNetwork = Chain;

// FIX: Explicitly typed the `chains` array as a non-empty array (`[AppKitNetwork, ...AppKitNetwork[]]`). This resolves a TypeScript error where the inferred array type was not assignable to the required non-empty array type for the `networks` property in `createAppKit`.
const chains: [AppKitNetwork, ...AppKitNetwork[]] = [
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
];

// Create the Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  networks: chains,
  projectId,
});

// 3. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: chains,
  metadata,
  projectId,
  features: {
    analytics: true,
  }
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
    const oldKeys = Object.keys(settings);
    const newKeys = Object.keys(newSettings);
    const addedKeys = newKeys.filter(k => !oldKeys.includes(k));

    setSettings(newSettings);
    
    // When settings change, update visibility for all profiles.
    setProfileVisibility(currentProfiles => {
      const newProfiles: ProfileVisibility = {};
      for (const profileName of PROFILE_NAMES) {
        const existingProfile = currentProfiles[profileName] || {};
        const newVisibility: VisibleButtons = {};
        
        // Iterate over all keys in the new settings to handle additions and preserve existing.
        // This also implicitly handles removals.
        Object.keys(newSettings).forEach(key => {
          if (addedKeys.includes(key)) {
            // This is a new button. Activate only for the active profile.
            newVisibility[key] = (profileName === activeProfile);
          } else {
            // This is an existing button. Preserve its visibility.
            // Default to true if it's somehow not set.
            newVisibility[key] = existingProfile[key] !== false;
          }
        });
        newProfiles[profileName] = newVisibility;
      }
      return newProfiles;
    });
  }, [settings, activeProfile]);

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
                    // On first launch, only make buttons visible for "Profile 1".
                    const shouldBeVisible = name === PROFILE_NAMES[0];
                    Object.keys(loadedSettings).forEach(key => {
                        visibility[key] = shouldBeVisible;
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
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;