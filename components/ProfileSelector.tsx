import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from './icons';

interface ProfileSelectorProps {
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  profileNames: string[];
}

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({ activeProfile, setActiveProfile, profileNames }) => {
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
        className="w-full bg-gray-700 text-white rounded-lg py-3 px-4 shadow-lg hover:bg-gray-600 transition-colors duration-200 flex items-center justify-between font-semibold"
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
