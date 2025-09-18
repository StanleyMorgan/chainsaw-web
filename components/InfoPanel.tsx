import React from 'react';
import { PlusIcon } from './icons';
import { ProfileSelector } from './ProfileSelector';

interface InfoPanelProps {
  hoveredDescription: string;
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  profileNames: string[];
  onAddButtonClick: () => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ 
  hoveredDescription,
  activeProfile,
  setActiveProfile,
  profileNames,
  onAddButtonClick
}) => {
  return (
    <div className="lg:col-span-5 xl:col-span-4">
        <div className="lg:sticky lg:top-24 space-y-4">
            {/* Description Panel */}
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 h-48 flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-2 flex-shrink-0 border-b border-gray-700 pb-2">Action Description</h3>
                <div className="overflow-y-auto pr-2 flex-grow">
                    <p className="text-gray-300 whitespace-pre-wrap">{hoveredDescription}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Profile Selector */}
                <div className="flex-1">
                    <ProfileSelector 
                        activeProfile={activeProfile}
                        setActiveProfile={setActiveProfile}
                        profileNames={profileNames}
                    />
                </div>
                {/* Add Button */}
                <div className="flex-1">
                    <button
                        onClick={onAddButtonClick}
                        className="w-full bg-green-600 text-white rounded-lg py-3 px-4 shadow-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center font-semibold"
                        title="Add New Button"
                        aria-label="Add New Button"
                    >
                        <PlusIcon className="w-6 h-6 mr-2" />
                        <span>Add Button</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
