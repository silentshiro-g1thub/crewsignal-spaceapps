import { useEffect, useState } from 'react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { isTauriRuntime } from '../bridge/desktopBridge';
import { getCheckInReminders } from '../shared/src';
import { useApp } from '../state/AppContext';

const KEY = 'crewsignal.check-in-notifications';
const EVENT = 'check-in-notifications-changed';

export function ScheduledNotificationSetting() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(KEY) === 'true');
  const { showToast } = useApp();
  if (!isTauriRuntime()) return null;

  return (
    <label>
      <input type="checkbox" checked={enabled} onChange={async (event) => {
        const requested = event.currentTarget.checked;
        try {
          const allowed = requested && (await isPermissionGranted() || await requestPermission() === 'granted');
          localStorage.setItem(KEY, String(allowed));
          setEnabled(allowed);
          window.dispatchEvent(new Event(EVENT));
          if (requested && !allowed) showToast({ tone: 'danger', title: 'Notification permission is unavailable' });
        } catch {
          showToast({ tone: 'danger', title: 'Could not change notification settings' });
        }
      }} />
      {' '}Local check-in notifications while CrewSignal is open
    </label>
  );
}

export function ScheduledNotifications() {
  const { activeProfile, snapshot, showToast } = useApp();
  const observations = snapshot?.profileData.observations;
  useEffect(() => {
    if (!isTauriRuntime() || !activeProfile || !observations) return;
    const plan = getCheckInReminders(activeProfile, observations);
    let stopped = false;
    async function deliver() {
      if (localStorage.getItem(KEY) !== 'true') return;
      try {
        if (!await isPermissionGranted() || stopped || localStorage.getItem(KEY) !== 'true') return;
        const now = activeProfile?.mode === 'demo' ? Date.parse(activeProfile.snapshotUtc ?? '') : Date.now();
        const sent = new Set<string>(JSON.parse(localStorage.getItem(KEY + '.sent') ?? '[]'));
        for (const { id, title, dueAt } of plan) {
          if (dueAt > now || sent.has(id)) continue;
          sendNotification({ title });
          sent.add(id);
          localStorage.setItem(KEY + '.sent', JSON.stringify([...sent].slice(-256)));
        }
      } catch {
        if (!stopped) showToast({ tone: 'danger', title: 'Could not deliver check-in notifications' });
      }
    }
    const check = () => { void deliver(); };
    check();
    const timer = window.setInterval(check, 30_000);
    window.addEventListener(EVENT, check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener(EVENT, check);
    };
  }, [activeProfile, observations, showToast]);
  return null;
}
