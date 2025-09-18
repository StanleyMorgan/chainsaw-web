import React from 'react';
import type { Settings, ButtonConfig } from '../types';

interface ActionButtonProps {
    buttonKey: string;
    config: ButtonConfig;
    onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ buttonKey, config, onClick }) => {
    return (
        <button
            onClick={onClick}
            style={{ backgroundColor: config.color, color: '#FFFFFF' }}
            className="w-full text-white font-bold py-4 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200 flex items-center justify-center"
        >
            <span className="capitalize">{buttonKey}</span>
        </button>
    );
};

interface ActionGridProps {
  visibleButtonKeys: string[];
  settings: Settings;
  onButtonClick: (key: string, config: ButtonConfig) => void;
  onButtonHoverStart: (description: string) => void;
  onButtonHoverEnd: () => void;
  dragAndDropHandlers: {
    handleDragStart: (e: React.DragEvent<HTMLDivElement>, key: string) => void;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: React.DragEvent<HTMLDivElement>, dropKey: string) => void;
    handleDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  };
}

export const ActionGrid: React.FC<ActionGridProps> = ({
  visibleButtonKeys,
  settings,
  onButtonClick,
  onButtonHoverStart,
  onButtonHoverEnd,
  dragAndDropHandlers,
}) => {
  return (
    <div className="lg:col-span-7 xl:col-span-8">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleButtonKeys.map(key => {
          const config = settings[key];
          if (!config) return null;

          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => dragAndDropHandlers.handleDragStart(e, key)}
              onDragOver={dragAndDropHandlers.handleDragOver}
              onDrop={(e) => dragAndDropHandlers.handleDrop(e, key)}
              onDragEnd={dragAndDropHandlers.handleDragEnd}
              onMouseEnter={() => onButtonHoverStart(config.description || 'No description provided.')}
              onMouseLeave={onButtonHoverEnd}
              className="cursor-move"
              title={config.description || key}
            >
              <ActionButton
                buttonKey={key}
                config={config}
                onClick={() => onButtonClick(key, config)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
