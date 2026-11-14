export const GETTING_STARTED_INTRO = 'Follow these steps offline with the synthetic Demo profile. You can revisit this walkthrough from Help.';
export const GETTING_STARTED_PERSONAL = 'Your Personal profile stays active. The sample steps are available when you select a Demo profile in Settings.';

export const GETTING_STARTED_STEPS = [
  {
    route: 'overview',
    title: 'Find the Demo readings',
    body: 'Look for the Demo label and the latest readings on Overview. The bundled SIM-01 profile contains synthetic readings. Check the latest sleep value and its mission day.',
    action: 'Open Demo Overview',
  },
  {
    route: 'trends',
    title: 'Follow the sleep trend',
    body: 'Open the sleep trend and try the data table. Compare the latest reading with earlier mission days and look for gaps where no reading was logged.',
    action: 'Open Sleep Trends',
  },
  {
    route: 'sources',
    title: 'Find the source',
    body: 'In Sources, look for NASA’s summary on sleep and schedules. Read the cached summary and its limitations offline.',
    action: 'Open cached Sources',
  },
  {
    route: 'reports',
    title: 'Preview a report',
    body: 'In Reports, preview a filtered report and review which readings it includes. Mood and private notes start excluded. The preview stays inside CrewSignal until you choose a file or sharing action.',
    action: 'Open Reports preview',
  },
] as const;

export type GettingStartedDestination = typeof GETTING_STARTED_STEPS[number]['route'];

export const GETTING_STARTED_STORAGE = 'Readings and drafts live in CrewSignal’s local SQLite database on this device.';
