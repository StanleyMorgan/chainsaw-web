

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { SettingsView } from './components/SettingsView';
import { Notification, NotificationData } from './components/Notification';
import type { Settings, VisibleButtons } from './types';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount } from 'wagmi';
import { mainnet, optimism, base, polygon, arbitrum } from 'wagmi/chains';
// Fix: Reordered imports to potentially address a parser issue causing a false-positive error on QueryClient export.
// FIX: Split the import for QueryClient to resolve a module resolution error, importing it directly from @tanstack/query-core.
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/query-core';

// This is a public demo project ID from WalletConnect.
// For a production application, you should get your own project ID from https://cloud.walletconnect.com/
const projectId = 'e89c620c02327429219e133e506689d0';

const config = getDefaultConfig({
  appName: 'Chainsaw',
  projectId: projectId,
  chains: [mainnet, optimism, base, polygon, arbitrum],
  ssr: false, // If your dApp uses server side rendering (SSR)
});

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const { isConnected } = useAccount();
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [settings, setSettings] = useState<Settings>({});
  const [visibleButtons, setVisibleButtons] = useState<VisibleButtons>({});
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const fetchAndSetDefaultSettings = useCallback(async (isInitialLoad = false) => {
    if (!isInitialLoad) {
      if (!window.confirm("Are you sure you want to reset all settings to default? This action cannot be undone.")) {
        return;
      }
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('https://raw.githubusercontent.com/StanleyMorgan/Chainsaw-config/main/settings.txt');
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const defaultSettings = await response.json();
      
      setSettings(defaultSettings);
      
      const newVisibility: VisibleButtons = {};
      Object.keys(defaultSettings).forEach(key => {
        newVisibility[key] = true;
      });
      setVisibleButtons(newVisibility);
      
      if (!isInitialLoad) {
        showNotification('Settings have been reset to default.', 'success');
      }
    } catch (error) {
      console.error("Failed to fetch or apply default settings:", error);
      showNotification('Failed to fetch default settings. Please check your internet connection.', 'error');
    } finally {
        if (isInitialLoad) {
            setIsLoading(false);
        }
    }
  }, [showNotification]);


  useEffect(() => {
    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const savedSettings = localStorage.getItem('chainsawSettings');
            if (savedSettings && savedSettings !== '{}') {
                const loadedSettings = JSON.parse(savedSettings);
                setSettings(loadedSettings);

                const savedVisibility = localStorage.getItem('chainsawVisibility');
                const loadedVisibility = savedVisibility ? JSON.parse(savedVisibility) : {};
                const initialVisibility: VisibleButtons = {};
                Object.keys(loadedSettings).forEach(key => {
                    initialVisibility[key] = loadedVisibility[key] !== false;
                });
                setVisibleButtons(initialVisibility);
            } else {
                await fetchAndSetDefaultSettings(true);
            }
        } catch (error) {
            console.error("Failed to load settings from localStorage, fetching default.", error);
            await fetchAndSetDefaultSettings(true);
        } finally {
            setIsLoading(false);
        }
    };
    loadSettings();
  }, [fetchAndSetDefaultSettings]);

  useEffect(() => {
    if (!isLoading && Object.keys(settings).length > 0) {
        try {
            localStorage.setItem('chainsawSettings', JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }
  }, [settings, isLoading]);

  useEffect(() => {
    if (!isLoading) {
        try {
            localStorage.setItem('chainsawVisibility', JSON.stringify(visibleButtons));
        } catch (error) {
            console.error("Failed to save visibility to localStorage", error);
        }
    }
  }, [visibleButtons, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl font-semibold animate-pulse">Loading configuration...</div>
      </div>
    );
  }

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
            setSettings={setSettings}
            visibleButtons={visibleButtons}
            setVisibleButtons={setVisibleButtons}
            showNotification={showNotification}
          />
        )}
        {view === 'settings' && isConnected && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            visibleButtons={visibleButtons}
            setVisibleButtons={setVisibleButtons}
            showNotification={showNotification}
            onReset={fetchAndSetDefaultSettings}
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