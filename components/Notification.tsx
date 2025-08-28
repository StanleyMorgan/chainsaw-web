
import React from 'react';

export interface NotificationData {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface NotificationProps {
  notification: NotificationData | null;
  setNotification: (notification: NotificationData | null) => void;
}

export const Notification: React.FC<NotificationProps> = ({ notification, setNotification }) => {
  if (!notification) return null;

  const baseClasses = 'fixed bottom-5 right-5 p-4 rounded-lg shadow-lg text-white max-w-sm z-50 transition-opacity duration-300 cursor-pointer';
  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div className={`${baseClasses} ${typeClasses[notification.type]}`} onClick={() => setNotification(null)}>
      <p>{notification.message}</p>
      <button className="absolute top-1 right-2 text-white font-bold">&times;</button>
    </div>
  );
};
