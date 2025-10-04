
import React, { useState } from 'react';
import type { Settings, VisibleButtons, ButtonConfig } from '../types';
import type { NotificationData } from './Notification';
import { useAccount } from 'wagmi';
import { AddButtonModal } from './AddButtonModal';
import { InputModal } from './InputModal';
import type { Abi, AbiFunction } from 'viem';
import { isAddress } from 'viem';
import { useChainsawActions } from '../hooks/useChainsawActions';
import { useButtonDragAndDrop } from '../hooks/useButtonDragAndDrop';
import { InfoPanel } from './InfoPanel';
import { ActionGrid } from './ActionGrid';

interface MainViewProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  visibleButtons: VisibleButtons;
  buttonOrder: string[];
  onReorder: (draggedKey: string, dropKey:string) => void;
  showNotification: (message: string, type: NotificationData['type'], duration?: number) => void;
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  profileNames: string[];
}

export const MainView: React.FC<MainViewProps> = ({ 
  settings, 
  setSettings, 
  visibleButtons, 
  buttonOrder, 
  onReorder, 
  showNotification, 
  activeProfile, 
  setActiveProfile, 
  profileNames 
}) => {
  const { address, isConnected } = useAccount();
  const { executeRead, handleTransaction, getExecutionConfig } = useChainsawActions(showNotification);
  const dragAndDropHandlers = useButtonDragAndDrop(onReorder);

  const [hoveredDescription, setHoveredDescription] = useState<string>('Hover over a button to see its description.');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [currentConfigForInput, setCurrentConfigForInput] = useState<{ key: string; config: ButtonConfig } | null>(null);

  const handleSaveButton = (key: string, config: ButtonConfig) => {
    const newSettings = { ...settings, [key]: config };
    setSettings(newSettings);
    showNotification(`Button "${key}" saved successfully!`, 'success');
  };

  const handleButtonClick = (key: string, config: ButtonConfig) => {
    if (!isConnected || !address) {
      showNotification('Please connect your wallet first.', 'info');
      return;
    }
    
    if (config.type === 'chained' && config.steps) {
        showNotification("Chained actions are not yet implemented.", "info");
        return;
    }

    const execConfig = getExecutionConfig(config);
    
    const needsAddress = execConfig.address === '$contractAddress';
    const needsChainId = execConfig.id === '$chainId';
    const needsColor = execConfig.color === '$color';
    const needsData = execConfig.data === '$data';
    const needsDescription = execConfig.description === '$description';
    let hasEmptyArgs = false;
    const isDeploy = execConfig.address === '';

    if (execConfig.abi) {
        const abi = execConfig.abi as Abi;
        const abiItem = isDeploy
            ? abi.find((item) => item.type === 'constructor')
            : abi.find((item): item is AbiFunction => item.type === 'function' && item.name === execConfig.functionName);

        // Ensure that the ABI item has an 'inputs' array before accessing it.
        if (abiItem && 'inputs' in abiItem && Array.isArray(abiItem.inputs) && abiItem.inputs.length > 0) {
            hasEmptyArgs = abiItem.inputs.some((input, index) => {
                const arg = execConfig.args?.[index];
                if (input.type === 'tuple') {
                    // For now, always prompt for tuples to ensure complex data is correct.
                    // A more sophisticated check could see if all tuple fields are filled.
                    return true; 
                }
                return arg === undefined || arg === null || arg === '';
            });
        }
    }

    if (hasEmptyArgs || needsAddress || needsChainId || needsColor || needsData || needsDescription) {
        setCurrentConfigForInput({ key, config: execConfig });
        setIsInputModalOpen(true);
    } else {
        if (execConfig.readOnly) {
          executeRead(execConfig, execConfig.args as any[]);
        } else {
          handleTransaction(execConfig);
        }
    }
  };

  const handleInputModalSubmit = (payload: { args: any[], contractAddress?: string, chainId?: string, color?: string, data?: string, description?: string }) => {
    if (currentConfigForInput) {
      const newConfig = { ...currentConfigForInput.config };
      if (payload.contractAddress) {
          newConfig.address = payload.contractAddress;
      }
      if (payload.chainId) {
          const chainIdNum = parseInt(payload.chainId, 10);
          if (!isNaN(chainIdNum)) {
              newConfig.id = chainIdNum;
          }
      }
      if (payload.color) {
          newConfig.color = payload.color;
      }
      if (payload.data) {
        newConfig.data = payload.data;
      }
      if (payload.description) {
          newConfig.description = payload.description;
      }

      if (newConfig.readOnly) {
        executeRead(newConfig, payload.args);
      } else {
        handleTransaction(newConfig, payload.args);
      }
    }
    setIsInputModalOpen(false);
    setCurrentConfigForInput(null);
  };
  
  const handleInputModalSave = (payload: { args: any[], contractAddress?: string, chainId?: string, color?: string, data?: string, description?: string }) => {
    if (currentConfigForInput) {
        const { key, config } = currentConfigForInput;
        const newConfig = { ...config, args: payload.args };

        if (config.address === '$contractAddress' && payload.contractAddress) {
            if (isAddress(payload.contractAddress)) {
                newConfig.address = payload.contractAddress;
            } else if (payload.contractAddress.trim() !== '') {
                showNotification('Invalid address provided. It was not saved.', 'error');
            }
        }

        if (config.id === '$chainId' && payload.chainId) {
            const chainIdNum = parseInt(payload.chainId, 10);
            if (!isNaN(chainIdNum)) {
                newConfig.id = chainIdNum;
            } else if (payload.chainId.trim() !== '') {
                showNotification('Invalid Chain ID provided. It was not saved.', 'error');
            }
        }
        
        if (config.color === '$color' && payload.color) {
            if (payload.color.trim() !== '') {
                newConfig.color = payload.color;
            } else {
                showNotification('Color value was empty. It was not saved.', 'error');
            }
        }
        
        if (config.data === '$data' && payload.data) {
            if (payload.data.trim() !== '') {
                newConfig.data = payload.data;
            } else {
                showNotification('Data value was empty. It was not saved.', 'error');
            }
        }

        if (config.description === '$description' && payload.description) {
            if (payload.description.trim() !== '') {
                newConfig.description = payload.description;
            } else {
                showNotification('Description was empty. It was not saved.', 'error');
            }
        }
        
        handleSaveButton(key, newConfig);
    }
  };
  
  const visibleButtonKeys = buttonOrder.filter(key => visibleButtons[key] !== false);

  return (
    <>
      <div>
        {isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <InfoPanel 
              hoveredDescription={hoveredDescription}
              activeProfile={activeProfile}
              setActiveProfile={setActiveProfile}
              profileNames={profileNames}
              onAddButtonClick={() => setIsAddModalOpen(true)}
            />
            
            <ActionGrid
              visibleButtonKeys={visibleButtonKeys}
              settings={settings}
              onButtonClick={handleButtonClick}
              onButtonHoverStart={(desc) => setHoveredDescription(desc)}
              onButtonHoverEnd={() => setHoveredDescription('Hover over a button to see its description.')}
              dragAndDropHandlers={dragAndDropHandlers}
            />
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to Chainsaw</h2>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Your powerful tool for interacting with smart contracts. Connect your wallet to get started.
            </p>
            <div className="inline-block">
              <w3m-button />
            </div>
          </div>
        )}
      </div>

      <AddButtonModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveButton}
        showNotification={showNotification}
        settings={settings}
      />
      
      {isInputModalOpen && currentConfigForInput && (
        <InputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          config={currentConfigForInput.config}
          onSubmit={handleInputModalSubmit}
          onSave={handleInputModalSave}
          showNotification={showNotification}
        />
      )}
    </>
  );
};
