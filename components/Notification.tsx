
import React from 'react';

export interface NotificationData {
  message: string;
  type: 'success' | 'error' | 'info' | 'read';
}

interface NotificationProps {
  notification: NotificationData | null;
  setNotification: (notification: NotificationData | null) => void;
}

export const Notification: React.FC<NotificationProps> = ({ notification, setNotification }) => {
  if (!notification) return null;

  const isRead = notification.type === 'read';

  const baseClasses = 'fixed rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 cursor-pointer';
  
  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    read: 'bg-gray-600',
  };

  const positionClasses = {
    success: 'bottom-5 right-5',
    error: 'bottom-5 right-5',
    info: 'bottom-5 right-5',
    read: 'bottom-5 left-5',
  };

  const dynamicClasses = isRead 
    ? 'max-w-lg p-6' // Larger size and padding for read
    : 'max-w-sm p-4'; // Default size and padding

  return (
    <div 
      className={`${baseClasses} ${positionClasses[notification.type]} ${typeClasses[notification.type]} ${dynamicClasses}`} 
      onClick={() => setNotification(null)}
    >
      <pre className="whitespace-pre-wrap font-mono text-sm">{notification.message}</pre>
      <button className="absolute top-1 right-2 text-white font-bold">&times;</button>
    </div>
  );
};
