import {
  RULE_VERSION_SLEEP_ACTION,
  type ActionContent,
  type AppPreferences,
  type EvidenceReference,
  type HelpProcedureCard,
  type Insight,
  type MetricId,
  type Observation,
  type PersonalReference,
} from './contracts';
import { compareObservationToReference, isObservationQualityEligible } from './references';
import { getObservationSortTimestampMs, getObservedMissionDay } from './timing';
import { METRIC_DEFINITIONS } from './metrics';
import { formatObservationDisplay, roundToDecimals } from './conversions';

export const RULE_VERSION_RAISE_READING = 'crewsignal-raise-reading-v1' as const;
export const RAISE_READING_SUGGESTION = 'Consider sharing a scoped report with your crew medical officer or flight surgeon.';
export const RAISE_READING_LIMIT = 'This reflects a pattern in self-logged data and cannot diagnose a health condition.';

export interface ReadingReportScope {
  profileId: string;
  observationIds: string[];
  metricIds: MetricId[];
  startDay: number;
  endDay: number;
}

export interface ReadingToRaise {
  observation: Observation;
  referenceId: string;
  referenceVersion: number;
  differenceText: string;
}

export const RAISE_READING_REASONS = {
  sustained: 'An indicator differed from its personal reference on three consecutive mission days.',
  multiple: 'Multiple indicators differed from their personal references on the same mission day.',
  recheck: 'A flagged reading and its repeat differed from the personal reference in the same direction.',
} as const;

/** Compare current patterns using stored, locked references and observed mission days. */
export function buildRaiseReadingPrompt(params: {
  profileId: string;
  observations: readonly Observation[];
  references: readonly PersonalReference[];
  rechecks?: readonly { flaggedObservationId: string; repeatObservationId: string }[];
}) {
  const observations = params.observations.filter((o) => o.profileId === params.profileId);
  if (observations.length === 0) return null;

  const references = new Map(params.references
    .filter((r) => r.profileId === params.profileId && r.status === 'active' && r.locked)
    .map((r) => [r.metricId, r]));
  const latestDay = observations.reduce((day, o) => Math.max(day, getObservedMissionDay(o)), 1);
  const latestByDay = new Map<number, Map<MetricId, Observation>>();
  const byId = new Map(observations.map((o) => [o.observationId, o]));
  for (const observation of observations) {
    const day = getObservedMissionDay(observation);
    if (observation.metricId === 'mood' || day < latestDay - 2) continue;
    if (observation.timing.kind === 'period' && observation.timing.sleepType !== 'main_sleep') continue;
    const byMetric = latestByDay.get(day) ?? new Map<MetricId, Observation>();
    latestByDay.set(day, byMetric);
    const previous = byMetric.get(observation.metricId);
    if (!previous || getObservationSortTimestampMs(observation) > getObservationSortTimestampMs(previous)
      || (getObservationSortTimestampMs(observation) === getObservationSortTimestampMs(previous)
        && observation.observationId < previous.observationId)) {
      byMetric.set(observation.metricId, observation);
    }
  }

  function difference(observation: Observation, flagged = false) {
    const reference = references.get(observation.metricId);
    if (!reference || reference.selectedObservationIds.includes(observation.observationId)) return null;
    const result = compareObservationToReference(
      flagged ? { ...observation, quality: 'valid' } : observation,
      reference,
    );
    if (!result.comparisonAvailable || !result.differenceText || result.deltaNumeric === null) return null;
    const diastolic = observation.canonical.kind === 'blood_pressure' && reference.value?.kind === 'blood_pressure'
      ? Math.sign(roundToDecimals(observation.canonical.diastolic - reference.value.diastolic, 1))
      : 0;
    const direction = `${Math.sign(result.deltaNumeric)}/${diastolic}`;
    if (direction === '0/0') return null;
    const reading: ReadingToRaise = {
      observation,
      referenceId: reference.referenceId,
      referenceVersion: reference.version,
      differenceText: result.differenceText,
    };
    return { reading, direction };
  }

  const reasons = new Set<keyof typeof RAISE_READING_REASONS>();
  const readings = new Map<string, ReadingToRaise>();
  function add(reason: keyof typeof RAISE_READING_REASONS, ...items: ReadingToRaise[]) {
    reasons.add(reason);
    for (const item of items) readings.set(item.observation.observationId, item);
  }

  const differingToday: ReadingToRaise[] = [];
  for (const observation of latestByDay.get(latestDay)?.values() ?? []) {
    const latest = difference(observation);
    if (!latest) continue;
    differingToday.push(latest.reading);
    const previous = latestByDay.get(latestDay - 1)?.get(observation.metricId);
    const earliest = latestByDay.get(latestDay - 2)?.get(observation.metricId);
    const middle = previous && difference(previous);
    const first = earliest && difference(earliest);
    if (middle?.direction === latest.direction && first?.direction === latest.direction) {
      add('sustained', first.reading, middle.reading, latest.reading);
    }
  }
  if (differingToday.length >= 2) add('multiple', ...differingToday);

  for (const pair of params.rechecks ?? []) {
    const flagged = byId.get(pair.flaggedObservationId);
    const repeat = byId.get(pair.repeatObservationId);
    if (!flagged || !repeat || flagged.metricId !== repeat.metricId
      || getObservedMissionDay(repeat) !== latestDay
      || getObservationSortTimestampMs(flagged) >= getObservationSortTimestampMs(repeat)) continue;
    const initialDifference = difference(flagged, true);
    const repeatedDifference = difference(repeat);
    if (initialDifference && initialDifference.direction === repeatedDifference?.direction) {
      add('recheck', initialDifference.reading, repeatedDifference.reading);
    }
  }

  if (readings.size === 0) return null;
  const sortedReadings = [...readings.values()].sort((a, b) =>
    getObservationSortTimestampMs(a.observation) - getObservationSortTimestampMs(b.observation)
    || a.observation.observationId.localeCompare(b.observation.observationId));
  const reportScope: ReadingReportScope = {
    profileId: params.profileId,
    observationIds: sortedReadings.map(({ observation }) => observation.observationId),
    metricIds: [...new Set(sortedReadings.map(({ observation }) => observation.metricId))],
    startDay: getObservedMissionDay(sortedReadings[0]!.observation),
    endDay: latestDay,
  };
  return { ruleVersion: RULE_VERSION_RAISE_READING, reasons: [...reasons], readings: sortedReadings, reportScope };
}

export const EVIDENCE_CHECKED_DATE = '2026-11-13' as const;

export const METRIC_ACTION_IDS = {
  heart_rate: 'action-review-pulse',
  blood_pressure: 'action-review-blood-pressure',
  blood_glucose: 'action-review-glucose',
  body_temperature: 'action-review-temperature',
  sleep: 'action-review-sleep-routine',
  mood: 'action-review-mood-context',
} as const satisfies Record<MetricId, string>;

/**
 * Canonical offline evidence registry. Each record carries its verification date.
 * The app bundles original attributed summaries and links to the publishers.
 */
export const EVIDENCE_REGISTRY: Record<string, EvidenceReference> = {
  'nasa-sleep-risk': {
    sourceId: 'nasa-sleep-risk',
    title: 'Risk from Inadequate Sleep and Irregular Schedules',
    shortTitle: 'NASA sleep & schedules',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: '2025-05-16',
    summaryVersion: 'Version 1',
    summaryText:
      'NASA research describes how irregular schedules, shifting work demands, and disrupted sleep environments can reduce total sleep and affect crew performance.',
    limitations:
      'General spaceflight research context only; not individualized medical diagnosis, duty-fitness clearance, or schedule authorization.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: ['sleep', 'mood'],
    relatedActionIds: ['action-review-sleep-routine'],
  },
  'nasa-seven-ways-sleep': {
    sourceId: 'nasa-seven-ways-sleep',
    title: 'Seven Ways Astronauts Improve Sleep',
    shortTitle: 'Seven ways astronauts improve sleep',
    publisher: 'NASA Station Mission Feature',
    url: 'https://www.nasa.gov/missions/station/seven-ways-astronauts-improve-sleep-may-help-you-snooze-better-on-earth/',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: null,
    summaryVersion: 'Version 1',
    summaryText:
      'Educational NASA mission guidance highlighting consistent sleep schedules, light/dark cues, quiet rest environments, and noting sleep interruptions.',
    limitations:
      'Educational habit context only; does not prescribe hours, lighting doses, caffeine timing, or medications.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: ['sleep'],
    relatedActionIds: ['action-review-sleep-routine'],
  },
  'nasa-standard-measures': {
    sourceId: 'nasa-standard-measures',
    title: 'NASA Standard Measures',
    shortTitle: 'NASA Standard Measures',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/reference/standard-measures/',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: null,
    summaryVersion: 'Version 1',
    summaryText:
      'Defines core physiological, behavioral, and sleep-wake observation domains collected across spaceflight research campaigns so distinct indicators stay contextualized.',
    limitations:
      'Research campaign framework; CrewSignal is an independent manual-entry prototype and does not adopt full study cadence or clinical validation.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      'heart_rate',
      'blood_pressure',
      'blood_glucose',
      'body_temperature',
      'sleep',
      'mood',
    ],
    relatedActionIds: ['action-review-sleep-routine', 'action-check-measurement-context'],
  },
  'nasa-hrp-hazards': {
    sourceId: 'nasa-hrp-hazards',
    title: 'Five Hazards of Human Spaceflight',
    shortTitle: 'NASA HRP hazards',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazards/',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: null,
    summaryVersion: 'Version 1',
    summaryText:
      'Frames spaceflight health risks across radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments.',
    limitations:
      'High-level mission hazard framing; does not establish autonomous diagnosis or EVA readiness.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: ['heart_rate', 'blood_pressure', 'sleep', 'mood'],
    relatedActionIds: [],
  },
  'nasa-hrp-risks': {
    sourceId: "nasa-hrp-risks",
    title: "Risks of Human Spaceflight",
    shortTitle: "NASA HRP risks",
    publisher: "NASA Human Research Program",
    url: "https://www.nasa.gov/hrp/risks/",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "NASA groups the risks it studies by the ways spaceflight can affect crew health and performance, including changes to the cardiovascular, immune and musculoskeletal systems.",
    limitations: "The overview describes risks across missions. It cannot determine a crew member's risk from a check-in.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [],
    relatedActionIds: [],
  },
  'nasa-ongoing-hrp-research': {
    sourceId: "nasa-ongoing-hrp-research",
    title: "Ongoing HRP Research",
    shortTitle: "NASA HRP research",
    publisher: "NASA Human Research Program",
    url: "https://www.nasa.gov/hrp/ongoing-hrp-research/",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "NASA lists studies that collect crew health and performance data. ARCHeR combines wearable activity and sleep data with crew feedback to study sleep in flight.",
    limitations: "Study methods and equipment differ from self-reported sleep and mood check-ins.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [],
    relatedActionIds: [],
  },
  'csa-radiation-monitoring': {
    sourceId: "csa-radiation-monitoring",
    title: "Monitoring radiation for astronaut health",
    shortTitle: "CSA radiation monitoring",
    publisher: "Canadian Space Agency",
    url: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: "2026-02-26",
    summaryVersion: "Version 1",
    summaryText: "The Canadian Active Neutron Spectrometer (CANS) is a dedicated instrument designed to measure neutron radiation exposure in space.",
    limitations: "The instrument measures the neutron component of radiation. CrewSignal has no radiation measurement or exposure estimate.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [],
    relatedActionIds: [],
  },
  'csa-iss-experiments': {
    sourceId: "csa-iss-experiments",
    title: "Why do we conduct science experiments in space?",
    shortTitle: "CSA space experiments",
    publisher: "Canadian Space Agency",
    url: "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Researchers use the International Space Station to study health changes in weightlessness and prepare for longer missions, with some findings also informing research on Earth.",
    limitations: "The explainer describes research goals. It provides no interpretation thresholds for individual check-ins.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [],
    relatedActionIds: [],
  },
  'nasa-human-research-roadmap': {
    sourceId: 'nasa-human-research-roadmap',
    title: 'NASA Human Research Roadmap — Risks',
    shortTitle: 'Human Research Roadmap',
    publisher: 'NASA Human Research Program',
    url: 'https://humanresearchroadmap.nasa.gov/risks/',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: null,
    summaryVersion: 'Version 1',
    summaryText:
      'Catalogs documented spaceflight human-system risks and research gaps, informing conservative separation between observation logging and clinical claims.',
    limitations:
      'Research gap inventory; hazard documentation does not authorize an individual clinical recommendation.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: ['heart_rate', 'blood_pressure', 'sleep', 'mood'],
    relatedActionIds: [],
  },
  'nasa-isolation-standard-measures': {
    sourceId: 'nasa-isolation-standard-measures',
    title: 'Isolation Standard Measures Manuscript (IAC 2022)',
    shortTitle: 'Isolation Standard Measures',
    publisher: 'NASA Technical Reports Server (NTRS)',
    url: 'https://ntrs.nasa.gov/api/citations/20220013722/downloads/IAC_ISM-2022-manuscript-final.pdf',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: null,
    summaryVersion: 'Version 1',
    summaryText:
      'Describes sleep diaries and distinct psychological/cognitive instruments used in analog isolation studies, motivating period-only sleep logging and honest custom mood scope.',
    limitations:
      'CrewSignal uses a custom single-item mood scale (crewsignal-mood-v1) rather than POMS/PANAS or validated cognitive batteries.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: ['sleep', 'mood'],
    relatedActionIds: [],
  },
  'cdc-nhanes-glucose': {
    sourceId: 'cdc-nhanes-glucose',
    title: 'CDC NHANES 2021–2022 Laboratory Procedure Manual — GLU-L-MET-508',
    shortTitle: 'CDC NHANES glucose units',
    publisher: 'Centers for Disease Control and Prevention (CDC)',
    url: 'https://wwwn.cdc.gov/nchs/data/nhanes/public/2021/labmethods/GLU-L-MET-508.pdf',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: null,
    summaryVersion: 'Version 1',
    summaryText:
      'Establishes the unit conversion factor used in CrewSignal: mmol/L × 18.02 = mg/dL (and exact reciprocal for mg/dL to mmol/L).',
    limitations:
      'Supports unit conversion arithmetic only; not a clinical threshold, sampling protocol, or mission-applicability rule.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: ['blood_glucose'],
    relatedActionIds: ['action-check-measurement-context'],
  },
  'nist-temperature-units': {
    sourceId: 'nist-temperature-units',
    title: 'NIST SI Units: Temperature',
    shortTitle: 'NIST temperature units',
    publisher: 'National Institute of Standards and Technology (NIST)',
    url: 'https://www.nist.gov/pml/owm/si-units-temperature',
    checkedDate: EVIDENCE_CHECKED_DATE,
    sourceUpdatedDate: null,
    summaryVersion: 'Version 1',
    summaryText:
      'Defines the exact Celsius/Fahrenheit equations used in CrewSignal: F = C × 1.8 + 32 and C = (F − 32) / 1.8.',
    limitations:
      'Unit conversion standard only; does not validate thermometer site compatibility or clinical fever cutoffs.',
    cachedAvailable: true,
    offlineAccessNote: 'Available offline: summary',
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: ['body_temperature'],
    relatedActionIds: ['action-check-measurement-context'],
  },
  "nlm-pulse": {
    sourceId: "nlm-pulse",
    title: "Pulse",
    shortTitle: "Pulse",
    publisher: "MedlinePlus",
    url: "https://medlineplus.gov/ency/article/003399.htm",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Describes what pulse measures and how to count it at the wrist.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "heart_rate"
    ],
    relatedActionIds: [METRIC_ACTION_IDS.heart_rate]
  },
  "aha-blood-pressure": {
    sourceId: "aha-blood-pressure",
    title: "Home Blood Pressure Monitoring",
    shortTitle: "Home Blood Pressure Monitoring",
    publisher: "American Heart Association",
    url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Explains upper-arm cuff use and the two blood pressure numbers.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "blood_pressure"
    ],
    relatedActionIds: [METRIC_ACTION_IDS.blood_pressure]
  },
  "nasa-standing-risk": {
    sourceId: "nasa-standing-risk",
    title: "Orthostatic Intolerance Technical Brief",
    shortTitle: "Orthostatic Intolerance Technical Brief",
    publisher: "NASA",
    url: "https://www.nasa.gov/wp-content/uploads/2023/03/orthostatic-intolerance-technical-brief-ochmo.pdf",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Describes heart rate and blood pressure responses when returning to gravity.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "heart_rate",
      "blood_pressure"
    ],
    relatedActionIds: []
  },
  "fda-glucose-meter": {
    sourceId: "fda-glucose-meter",
    title: "Blood Glucose Monitoring Devices",
    shortTitle: "Blood Glucose Monitoring Devices",
    publisher: "FDA",
    url: "https://www.fda.gov/medical-devices/in-vitro-diagnostics/blood-glucose-monitoring-devices",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Explains what glucose meters measure and how to use a meter and test strip.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "blood_glucose"
    ],
    relatedActionIds: [METRIC_ACTION_IDS.blood_glucose]
  },
  "nasa-human-adaptation": {
    sourceId: "nasa-human-adaptation",
    title: "Human Adaptation to Spaceflight",
    shortTitle: "Human Adaptation to Spaceflight",
    publisher: "NASA",
    url: "https://www.nasa.gov/wp-content/uploads/2024/08/human-adaptation-2021-final-b.pdf",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Reviews limited evidence on changes in how the body handles blood sugar during spaceflight.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "blood_glucose"
    ],
    relatedActionIds: []
  },
  "nlm-temperature": {
    sourceId: "nlm-temperature",
    title: "Temperature Measurement",
    shortTitle: "Temperature Measurement",
    publisher: "MedlinePlus",
    url: "https://medlineplus.gov/ency/article/003400.htm",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Explains how to measure body temperature and why measurement site matters.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "body_temperature"
    ],
    relatedActionIds: [METRIC_ACTION_IDS.body_temperature]
  },
  "nasa-body-temperature": {
    sourceId: "nasa-body-temperature",
    title: "Monitoring Astronaut Body Temperature",
    shortTitle: "Monitoring Astronaut Body Temperature",
    publisher: "NASA",
    url: "https://www.nasa.gov/help-nasa-find-practical-ways-to-monitor-astronaut-body-temperature-in-low-earth-orbit/",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Summarizes early evidence about temperature changes during exercise in low gravity.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "body_temperature"
    ],
    relatedActionIds: []
  },
  "nih-sleep-diary": {
    sourceId: "nih-sleep-diary",
    title: "Sleep Diary",
    shortTitle: "Sleep Diary",
    publisher: "NHLBI, NIH",
    url: "https://www.nhlbi.nih.gov/resources/sleep-diary",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Provides a diary for recording how much and how well you slept.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "sleep"
    ],
    relatedActionIds: []
  },
  "nasa-behavioral-measures": {
    sourceId: "nasa-behavioral-measures",
    title: "Standardized Behavioral Measures for Exploration Missions",
    shortTitle: "Standardized Behavioral Measures for Exploration Missions",
    publisher: "NASA Human Research Roadmap",
    url: "https://humanresearchroadmap.nasa.gov/Tasks/task.aspx?i=1623",
    checkedDate: "2026-11-14",
    sourceUpdatedDate: null,
    summaryVersion: "Version 1",
    summaryText: "Identifies self-reported mood as one of several behavioral health indicators.",
    limitations: "Background for the check-in. Follow approved mission procedures for measurements.",
    cachedAvailable: true,
    offlineAccessNote: "Available offline: summary",
    knownUpdateAvailableVersion: null,
    knownUpdateCheckedDate: null,
    relatedMetricIds: [
      "mood"
    ],
    relatedActionIds: [METRIC_ACTION_IDS.mood]
  },
};

export const EVIDENCE_LIST: readonly EvidenceReference[] = Object.values(EVIDENCE_REGISTRY);

function measurementAction(
  metricId: Exclude<MetricId, 'sleep'>,
  title: string,
  applicability: string,
  steps: string[],
  sourceId: string,
): ActionContent {
  const actionId = METRIC_ACTION_IDS[metricId];
  return {
    actionId,
    title,
    category: 'educational',
    badgeLabel: 'Educational · Prototype',
    enabled: true,
    disabledReason: null,
    applicability,
    limitation: 'For reviewing your log. This step cannot diagnose a condition or determine treatment.',
    triggerSummary: metricId === 'mood'
      ? 'Review context alongside your mood history.'
      : 'Use this step to review how you logged the reading. A personalized comparison requires a compatible reference.',
    steps,
    sourceIds: [sourceId],
    sourceVersion: 'Version 1',
    ruleId: `rule-${metricId.replaceAll('_', '-')}-context`,
    ruleVersion: `crewsignal-${metricId.replaceAll('_', '-')}-guidance-v1`,
    reviewStatus: 'reviewed_educational',
  };
}

export const ACTION_CONTENT_REGISTRY: Record<string, ActionContent> = {
  'action-review-sleep-routine': {
    actionId: 'action-review-sleep-routine',
    title: 'Review sleep routine',
    category: 'educational',
    badgeLabel: 'Educational · Prototype',
    enabled: true,
    disabledReason: null,
    applicability: 'Use your approved mission procedures for individual decisions.',
    limitation:
      'This comparison describes your entry; it does not assess fitness for duty or prescribe hours, medications, caffeine, lighting doses, or schedule changes.',
    triggerSummary: 'Compare a Main sleep entry with your personal sleep reference when the method and context match.',
    steps: [
      'Check the recorded sleep period and whether any sleep window included awake time.',
      'Review your approved rest schedule for recent shift changes or irregular timing.',
      'Note interruptions or environmental context for your available mission support.',
    ],
    sourceIds: ['nasa-sleep-risk', 'nasa-seven-ways-sleep', 'nasa-standard-measures'],
    sourceVersion: 'Version 1',
    ruleId: 'rule-sleep-vs-reference',
    ruleVersion: RULE_VERSION_SLEEP_ACTION,
    reviewStatus: 'reviewed_educational',
  },
  [METRIC_ACTION_IDS.heart_rate]: measurementAction(
    'heart_rate', 'Review pulse measurement',
    'Activity and the way you count your pulse can affect how comparable readings are.',
    ['If you repeat the reading, rest first and use the same counting method. Note recent activity in the log.'],
    'nlm-pulse',
  ),
  [METRIC_ACTION_IDS.blood_pressure]: measurementAction(
    'blood_pressure', 'Review cuff setup',
    'Cuff placement, arm support and posture affect the measurement context.',
    ['Check the cuff placement and arm support. Record the posture and keep both numbers together.'],
    'aha-blood-pressure',
  ),
  [METRIC_ACTION_IDS.blood_glucose]: measurementAction(
    'blood_glucose', 'Review glucose measurement context',
    'Meter technique and meal timing help you compare entries taken under similar conditions.',
    ['Check the meter and test-strip instructions. Note when you last ate and keep the original unit in the log.'],
    'fda-glucose-meter',
  ),
  [METRIC_ACTION_IDS.body_temperature]: measurementAction(
    'body_temperature', 'Review temperature measurement site',
    'Readings taken at different sites can differ.',
    ['Record the thermometer type and measurement site. Use the same site and method if you repeat the reading.'],
    'nlm-temperature',
  ),
  [METRIC_ACTION_IDS.mood]: measurementAction(
    'mood', 'Review mood context',
    'A note about recent sleep or workload can help you remember the context of a self-report.',
    ['Review your mood history and note relevant sleep or workload changes alongside the entry.'],
    'nasa-behavioral-measures',
  ),
  'action-check-measurement-context': {
    actionId: 'action-check-measurement-context',
    title: 'Check measurement context',
    category: 'data_quality',
    badgeLabel: 'Data quality',
    enabled: true,
    disabledReason: null,
    applicability:
      'Applies whenever measurement method, resting context, or input units are missing or differ from your reference.',
    limitation:
      'Improves log comparability only; does not interpret values clinically.',
    triggerSummary:
      'Triggered when an entry has method "Not specified" or differs from active reference context.',
    steps: [
      'Confirm the instrument method and resting/post-exercise context if known.',
      'Keep original entered units and timestamps intact when reviewing conversions.',
      'Only compare observations recorded with compatible methods and contexts.',
    ],
    sourceIds: ['nasa-standard-measures', 'cdc-nhanes-glucose', 'nist-temperature-units'],
    sourceVersion: 'Version 1',
    ruleId: 'rule-measurement-quality',
    ruleVersion: 'crewsignal-quality-v1',
    reviewStatus: 'reviewed_educational',
  },
  'action-clinical-procedure-slot': {
    actionId: 'action-clinical-procedure-slot',
    title: 'Mission procedures',
    category: 'clinical_procedure',
    badgeLabel: 'Not configured',
    enabled: false,
    disabledReason:
      'Clinical treatment or mission-specific procedure guidance remains disabled unless applicable reviewed mission content is supplied.',
    applicability: 'Requires applicable reviewed content from your mission operations team.',
    limitation:
      'No clinical triage, dosing, or unreviewed medical procedure is included in the default prototype.',
    triggerSummary: 'Disabled until reviewed mission-specific procedures are configured.',
    steps: [],
    sourceIds: [],
    sourceVersion: 'Unconfigured',
    ruleId: 'rule-clinical-slot-disabled',
    ruleVersion: 'crewsignal-clinical-gate-v1',
    reviewStatus: 'disabled_unreviewed',
  },
};

export const ACTION_CONTENT_LIST: readonly ActionContent[] = Object.values(
  ACTION_CONTENT_REGISTRY,
);

export function getMetricAction(metricId: MetricId): ActionContent {
  return ACTION_CONTENT_REGISTRY[METRIC_ACTION_IDS[metricId]]!;
}

export const DEFAULT_UNCONFIGURED_HELP: HelpProcedureCard = {
  mode: 'unconfigured',
  statusTitle: 'Mission-specific guidance not configured',
  fixtureBanner: null,
  versionLabel: null,
  cachedAvailable: true,
  body: 'Use your approved onboard procedures and available mission support. This prototype cannot assess urgency or contact support.',
  steps: [
    'Consult your approved onboard medical and flight-crew procedures.',
    'Use your available mission support channel outside this prototype if needed.',
    'Help stays available offline without completing a check-in or baseline.',
  ],
  limitation:
    'No diagnosis, clinician directory, phone number, chat channel, or Send delivery is configured in CrewSignal.',
  offlineFacts: [
    'Cached research summaries are available offline.',
    'No mission procedure is stored.',
    'No check-in or reference is required to open Help.',
  ],
};

export const CONFIGURED_HELP_TEST_FIXTURE: HelpProcedureCard = {
  mode: 'configured_fixture',
  statusTitle: 'Configured Help',
  fixtureBanner: 'Example procedure card · Test fixture',
  versionLabel: 'Version demo 1 · Cached example',
  cachedAvailable: true,
  body: 'Example content for navigation and offline access testing only. Real mission guidance requires supplied applicable reviewed content before enabling it.',
  contactRoute: 'Example contact route (test fixture only): use the onboard mission communications channel to reach the crew medical officer.',
  steps: [
    'Verify the local cached procedure version and check date before relying on offline copy.',
    'Follow your team-supplied onboard procedure document rather than this test placeholder.',
  ],
  limitation:
    'Test fixture only: no approved medical steps, clinician contact, or authority are fabricated.',
  offlineFacts: [
    'Example procedure card · Test fixture is cached locally.',
    'Cached research summaries are available offline.',
    'Real mission guidance requires supplied reviewed content.',
  ],
};

export function resolveHelpContent(
  helpMode: AppPreferences['helpMode'],
): HelpProcedureCard {
  return helpMode === 'configured_fixture'
    ? CONFIGURED_HELP_TEST_FIXTURE
    : DEFAULT_UNCONFIGURED_HELP;
}

export function describeMissionContact(helpMode: AppPreferences['helpMode']): string {
  return resolveHelpContent(helpMode).contactRoute ?? 'No mission contact route is configured in Help.';
}

/**
 * Builds version-pinned guidance when the reading has a compatible reference.
 */
export function buildMetricInsight(metricId: MetricId, params: {
  observation: Observation;
  reference: PersonalReference | null;
  createdAtUtc: string;
}): Insight | null {
  const { observation, reference, createdAtUtc } = params;
  if (observation.metricId !== metricId || !reference || reference.metricId !== metricId ||
      reference.profileId !== observation.profileId) return null;
  const cmp = compareObservationToReference(observation, reference);
  if (!cmp.comparisonAvailable) return null;
  const action = getMetricAction(metricId);

  const sourceVersions: Record<string, string> = {};
  for (const sid of action.sourceIds) {
    const version = EVIDENCE_REGISTRY[sid]?.summaryVersion;
    if (!version?.trim()) return null;
    sourceVersions[sid] = version;
  }

  const display = formatObservationDisplay(observation, { blood_glucose: 'mg/dL', body_temperature: 'C' });
  const reading = metricId === 'sleep' ? display.valueOnlyText : display.enteredText;
  const difference = metricId === 'sleep' && cmp.deltaNumeric === 0
    ? 'Matches personal reference'
    : cmp.differenceText;

  return {
    insightId: `insight-${observation.observationId}-refv${cmp.referenceVersion ?? 0}-${action.ruleVersion}`,
    profileId: observation.profileId,
    metricId,
    observationId: observation.observationId,
    referenceId: cmp.referenceId,
    referenceVersion: cmp.referenceVersion,
    ruleId: action.ruleId,
    ruleVersion: action.ruleVersion,
    sourceIds: action.sourceIds,
    sourceVersions,
    comparisonAvailable: cmp.comparisonAvailable,
    unavailableReason: cmp.unavailableReason,
    summary: `${METRIC_DEFINITIONS[metricId].name} ${reading} · ${difference}`,
    differenceText: cmp.differenceText,
    deltaNumeric: cmp.deltaNumeric,
    deltaUnit: cmp.deltaUnit,
    status: 'active',
    reviewedAtUtc: null,
    createdAtUtc,
  };
}

export function buildSleepInsight(params: Parameters<typeof buildMetricInsight>[1]): Insight | null {
  return buildMetricInsight('sleep', params);
}

/**
 * Marks an Insight as reviewed for its specific observation/reference/rule/source version.
 * Never alters observations, clears health risk, or suppresses future observations.
 */
export function markInsightReviewed(
  insight: Insight,
  reviewedAtUtc: string,
): Insight {
  const identity = guidanceReviewIdentity(insight);
  if (!identity) throw new Error('Cannot review guidance with incomplete identity or source versions.');
  return {
    ...insight,
    sourceIds: [...insight.sourceIds],
    sourceVersions: { ...insight.sourceVersions },
    insightId: identity,
    status: 'reviewed',
    reviewedAtUtc,
  };
}

/**
 * Checks whether a saved review acknowledgement applies to a newer observation or version.
 * Canonical profile/observation/reference/rule/source identity. Incomplete legacy tuples
 * remain history and cannot establish a current acknowledgement.
 */
export function guidanceReviewIdentity(insight: Partial<Insight>): string | null {
  const { profileId, observationId, referenceId, referenceVersion, ruleId, ruleVersion, sourceIds, sourceVersions } = insight;
  if (!profileId || !observationId || !ruleId || !ruleVersion || !sourceIds?.length || !sourceVersions) return null;
  if (!(referenceId === null && referenceVersion === null) &&
      !(typeof referenceId === 'string' && referenceId.length > 0 && typeof referenceVersion === 'number' && Number.isInteger(referenceVersion) && referenceVersion > 0)) return null;
  const ids = [...new Set(sourceIds)].sort();
  if (ids.length !== sourceIds.length || Object.keys(sourceVersions).length !== ids.length ||
      ids.some(id => !id || typeof sourceVersions[id] !== 'string' || !sourceVersions[id]!.trim())) return null;
  return 'guidance-review:' + encodeURIComponent(JSON.stringify([
    profileId, observationId, referenceId, referenceVersion, ruleId, ruleVersion,
    ids.map(id => [id, sourceVersions[id]]),
  ]));
}

export function isInsightReviewCurrent(reviewed: Partial<Insight>, current: Insight): boolean {
  const identity = guidanceReviewIdentity(current);
  return !!identity && reviewed.status === 'reviewed' && !!reviewed.reviewedAtUtc &&
    guidanceReviewIdentity(reviewed) === identity;
}

export function findCurrentInsightReview(reviews: readonly Partial<Insight>[], current: Insight | null): Partial<Insight> | null {
  return current ? reviews.find(review => isInsightReviewCurrent(review, current)) ?? null : null;
}
