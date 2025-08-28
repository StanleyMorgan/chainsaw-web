import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { SettingsView } from './components/SettingsView';
import { Notification, NotificationData } from './components/Notification';
import { DEFAULT_SETTINGS } from './constants';
import type { Settings, VisibleButtons } from './types';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, optimism, base, polygon, arbitrum } from 'wagmi/chains';
// Fix: Reordered imports to potentially address a parser issue causing a false-positive error on QueryClient export.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [visibleButtons, setVisibleButtons] = useState<VisibleButtons>({});
  const [notification, setNotification] = useState<NotificationData | null>(null);
  
  // Load settings from localStorage on initial render
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('chainsawSettings');
      const savedVisibility = localStorage.getItem('chainsawVisibility');
      
      const loadedSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
      setSettings(loadedSettings);

      const loadedVisibility = savedVisibility ? JSON.parse(savedVisibility) : {};
      const initialVisibility: VisibleButtons = {};
      Object.keys(loadedSettings).forEach(key => {
        initialVisibility[key] = loadedVisibility[key] !== false;
      });
      setVisibleButtons(initialVisibility);

    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
      setSettings(DEFAULT_SETTINGS);
      const initialVisibility: VisibleButtons = {};
      Object.keys(DEFAULT_SETTINGS).forEach(key => {
        initialVisibility[key] = true;
      });
      setVisibleButtons(initialVisibility);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chainsawSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('chainsawVisibility', JSON.stringify(visibleButtons));
    } catch (error) {
      console.error("Failed to save visibility to localStorage", error);
    }
  }, [visibleButtons]);


  const showNotification = useCallback((message: string, type: NotificationData['type'], duration: number = 5000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  }, []);


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
            visibleButtons={visibleButtons} 
            showNotification={showNotification}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            visibleButtons={visibleButtons}
            setVisibleButtons={setVisibleButtons}
            showNotification={showNotification}
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
