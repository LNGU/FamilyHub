'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  requestPermission: () => Promise<boolean>;
  scheduleReminder: (minutes: number, message?: string) => Promise<boolean>;
  scheduleEventReminder: (eventTime: Date, eventTitle: string, minutesBefore?: number) => Promise<boolean>;
  cancelReminder: () => void;
  reminderSet: boolean;
  reminderTime: Date | null;
}

export function useNotifications(): UseNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [reminderSet, setReminderSet] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
      }
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }, [isSupported]);

  const scheduleReminder = useCallback(async (minutes: number, message?: string): Promise<boolean> => {
    if (!isSupported) return false;

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    if (timerId) {
      clearTimeout(timerId);
    }

    const delayMs = minutes * 60 * 1000;
    const notifyTime = new Date(Date.now() + delayMs);
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        delay: delayMs,
        title: 'FamilyHub',
        body: message || `Reminder: ${minutes} minutes have passed`
      });
      
      setReminderSet(true);
      setReminderTime(notifyTime);
      return true;
    }

    const id = setTimeout(() => {
      if (permission === 'granted') {
        new Notification('FamilyHub', {
          body: message || `Reminder: ${minutes} minutes have passed`,
          icon: '/icon-192.png',
          tag: 'reminder',
          requireInteraction: true,
        });
      }
      setReminderSet(false);
      setReminderTime(null);
    }, delayMs);

    setTimerId(id);
    setReminderSet(true);
    setReminderTime(notifyTime);
    return true;
  }, [isSupported, permission, requestPermission, timerId]);

  // New: Schedule reminder for calendar events (15 min before by default)
  const scheduleEventReminder = useCallback(async (
    eventTime: Date, 
    eventTitle: string, 
    minutesBefore: number = 15
  ): Promise<boolean> => {
    if (!isSupported) return false;

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    const now = Date.now();
    const reminderTimeMs = eventTime.getTime() - (minutesBefore * 60 * 1000);
    const delayMs = reminderTimeMs - now;

    // Don't schedule if event is in the past or reminder time already passed
    if (delayMs <= 0) return false;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        delay: delayMs,
        title: 'FamilyHub - Upcoming Event',
        body: `${eventTitle} starts in ${minutesBefore} minutes`,
        tag: `event-${eventTime.getTime()}`
      });
      return true;
    }

    // Fallback for when service worker isn't available
    setTimeout(() => {
      if (permission === 'granted') {
        new Notification('FamilyHub - Upcoming Event', {
          body: `${eventTitle} starts in ${minutesBefore} minutes`,
          icon: '/icon-192.png',
          tag: `event-${eventTime.getTime()}`,
          requireInteraction: true,
        });
      }
    }, delayMs);

    return true;
  }, [isSupported, permission, requestPermission]);

  const cancelReminder = useCallback(() => {
    if (timerId) {
      clearTimeout(timerId);
      setTimerId(null);
    }
    setReminderSet(false);
    setReminderTime(null);
  }, [timerId]);

  return {
    isSupported,
    permission,
    requestPermission,
    scheduleReminder,
    scheduleEventReminder,
    cancelReminder,
    reminderSet,
    reminderTime
  };
}
