import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getCheckInReminders } from '../shared/src';
import { useCrewSignal } from '../state/CrewSignalContext';

const CHANNEL = 'scheduled-check-ins';
const PREFIX = 'crewsignal-check-in:';
let pending = Promise.resolve();


export async function requestCheckInNotificationPermission() {
  const notifications = await import('expo-notifications');
  await notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Scheduled check-ins',
    importance: notifications.AndroidImportance.DEFAULT,
  });
  return (await notifications.requestPermissionsAsync()).granted;
}

export function ScheduledNotifications() {
  const { activeProfile, preferences, snapshot, announce } = useCrewSignal();
  const observations = snapshot?.active.observations;
  const enabled = preferences?.checkInNotifications === true;

  useEffect(() => {
    if (Platform.OS !== 'android' || !activeProfile || !observations) return;
    let cancelled = false;
    pending = pending.catch(() => {}).then(async () => {
      if (cancelled) return;
      const notifications = await import('expo-notifications');
      const { default: storage } = await import('expo-sqlite/kv-store');
      const previous = new Set<string>(JSON.parse(await storage.getItem(PREFIX) ?? '[]'));
      const permitted = enabled && (await notifications.getPermissionsAsync()).granted;
      const plan = permitted ? getCheckInReminders(activeProfile, observations) : [];
      const desired = new Set(plan.map(({ id }) => id));
      const existing = await notifications.getAllScheduledNotificationsAsync();
      if (cancelled) return;
      for (const { identifier } of existing) {
        if (identifier.startsWith(PREFIX) && !desired.has(identifier)) {
          await notifications.cancelScheduledNotificationAsync(identifier);
          previous.delete(identifier);
        }
      }
      for (const { id, title, dueAt } of plan) {
        if (cancelled) return;
        if (existing.some(({ identifier }) => id === identifier)) {
          previous.add(id);
          continue;
        }
        if (previous.has(id) && dueAt <= Date.now()) continue;
        const date = new Date(Math.max(Date.now() + 1000,
          activeProfile.mode === 'demo' ? Date.now() + dueAt - Date.parse(activeProfile.snapshotUtc ?? '') : dueAt));
        await notifications.scheduleNotificationAsync({
          identifier: id,
          content: { title },
          trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
        });
        previous.add(id);
      }
      await storage.setItem(PREFIX, JSON.stringify([...previous].filter((id) => desired.has(id))));
    }).catch(() => { if (!cancelled && enabled) announce('Could not update scheduled check-in notifications.'); });
    return () => { cancelled = true; };
  }, [activeProfile, observations, enabled, announce]);

  return null;
}
