import {
  CONVERSION_RULE_VERSION,
  MOOD_QUESTION_TEXT,
  MOOD_SCALE_ID,
  MOOD_SCALE_VERSION,
  type BodySystemDefinition,
  type BodySystemId,
  type CanonicalObservationValue,
  type CheckInDraft,
  type DraftValidationState,
  type EnteredObservationValue,
  type GlucoseUnit,
  type MetricDefinition,
  type MetricId,
  type MoodLabel,
  type Observation,
  type ObservationTiming,
  type ProfileConfig,
  type SleepType,
  type TemperatureUnit,
} from './contracts';
import {
  convertGlucose,
  convertTemperature,
  countDecimalPlaces,
} from './conversions';
import {
  buildInstantTiming,
  buildPeriodTiming,
  evaluateMetricSchedule,
  missionDayAndTimeToUtc,
  parseHHMM,
  validateSleepWindow,
} from './timing';

export interface MoodChoice {
  score: 1 | 2 | 3 | 4 | 5;
  label: MoodLabel;
}

export const MOOD_SCALE_SPEC = {
  scaleId: MOOD_SCALE_ID,
  scaleVersion: MOOD_SCALE_VERSION,
  questionText: MOOD_QUESTION_TEXT,
  choices: [
    { score: 1, label: 'Very low' },
    { score: 2, label: 'Low' },
    { score: 3, label: 'Neutral' },
    { score: 4, label: 'Good' },
    { score: 5, label: 'Very good' },
  ] as readonly MoodChoice[],
} as const;

export function getMoodLabel(score: 1 | 2 | 3 | 4 | 5): MoodLabel {
  const found = MOOD_SCALE_SPEC.choices.find((c) => c.score === score);
  if (!found) {
    throw new RangeError(`Invalid mood score: ${score}`);
  }
  return found.label;
}

export const SLEEP_TYPE_LABELS: Record<SleepType, string> = {
  main_sleep: 'Main sleep',
  nap: 'Nap',
  other: 'Other',
};

export const METRIC_DEFINITIONS: Record<MetricId, MetricDefinition> = {
  heart_rate: {
    id: 'heart_rate',
    name: 'Resting heart rate',
    shortLabel: 'Heart rate',
    bodySystem: 'cardiovascular',
    canonicalUnit: 'bpm',
    acceptedUnits: ['bpm'],
    timingMode: 'instant',
    entryMode: 'manual',
    methodOptions: [
      'Manual pulse count',
      'Optical wearable',
      'Chest strap',
      'Not specified',
    ],
    contextOptions: ['At rest', 'Post-exercise', 'Morning seated', 'Not specified'],
    purpose:
      'Track resting heart rate observations with explicit measurement method and context so comparisons match like with like.',
    instructions: [
      'Enter beats per minute (bpm) from your instrument or manual count.',
      'Use the time the reading was observed.',
      'Record measurement method and resting context when known.',
    ],
    whyItMatters: {
      text: "Pulse tells you how many times your heart beats in one minute.",
      sourceId: "nlm-pulse",
    },
    spaceflightContext: {
      text: "After time in low gravity, standing back in gravity can put extra demands on the heart and circulation.",
      sourceId: "nasa-standing-risk",
    },
    howToMeasure: {
      text: "While resting, feel for your pulse at your wrist with two fingers. Count the beats for one minute.",
      sourceId: "nlm-pulse",
    },
    evidenceIds: ["nasa-hrp-hazards","nasa-standard-measures","nlm-pulse","nasa-standing-risk"],
    supportsUnavailableInstrument: true,
    optionalSchedulingSupported: true,
  },
  blood_pressure: {
    id: 'blood_pressure',
    name: 'Blood pressure',
    shortLabel: 'Blood pressure',
    bodySystem: 'cardiovascular',
    canonicalUnit: 'mmHg',
    acceptedUnits: ['mmHg'],
    timingMode: 'instant',
    entryMode: 'manual',
    methodOptions: ['Manual cuff', 'Automated cuff', 'Not specified'],
    contextOptions: ['At rest', 'Seated', 'Standing', 'Post-exercise', 'Not specified'],
    purpose:
      'Record systolic and diastolic blood pressure together as one paired observation in mmHg.',
    instructions: [
      'Enter both systolic and diastolic mmHg values from one measurement.',
      'Use the time the reading was observed.',
      'Record cuff method and body context when known.',
    ],
    whyItMatters: {
      text: "The top number shows pressure when the heart beats. The bottom number shows pressure between beats.",
      sourceId: "aha-blood-pressure",
    },
    spaceflightContext: {
      text: "After time in low gravity, the body can have trouble keeping blood pressure steady when standing back in gravity.",
      sourceId: "nasa-standing-risk",
    },
    howToMeasure: {
      text: "Follow your cuff instructions. For a seated reading, rest first and support your bare upper arm at heart level. Record both numbers from the same reading.",
      sourceId: "aha-blood-pressure",
    },
    evidenceIds: ["nasa-hrp-hazards","nasa-standard-measures","aha-blood-pressure","nasa-standing-risk"],
    supportsUnavailableInstrument: true,
    optionalSchedulingSupported: true,
  },
  blood_glucose: {
    id: 'blood_glucose',
    name: 'Blood glucose',
    shortLabel: 'Blood glucose',
    bodySystem: 'nutrition_metabolism',
    canonicalUnit: 'mg/dL',
    acceptedUnits: ['mg/dL', 'mmol/L'],
    timingMode: 'instant',
    entryMode: 'manual',
    methodOptions: ['Fingerstick meter', 'Lab strip', 'Not specified'],
    contextOptions: ['Fasting', 'Post-meal', 'At rest', 'Not specified'],
    purpose:
      'Record optional blood glucose entries with explicit mg/dL or mmol/L unit selection and normalized review.',
    instructions: [
      'Enter the value and unit from your instrument.',
      'Units: mg/dL or mmol/L.',
      'Use the time the reading was observed.',
      'Record method and context when known.',
      'This app converts concentration units for review. It does not supply a measurement procedure.',
      'Follow your approved mission and device instructions.',
    ],
    whyItMatters: {
      text: "Blood glucose tells you how much sugar is in your blood at the time of the check.",
      sourceId: "fda-glucose-meter",
    },
    spaceflightContext: {
      text: "NASA reports early signs that spaceflight may change how the body handles blood sugar. Evidence from flight is limited.",
      sourceId: "nasa-human-adaptation",
    },
    howToMeasure: {
      text: "Follow your meter instructions for using a blood sample and test strip. Record the result with the unit shown.",
      sourceId: "fda-glucose-meter",
    },
    evidenceIds: ["cdc-nhanes-glucose","nasa-standard-measures","fda-glucose-meter","nasa-human-adaptation"],
    supportsUnavailableInstrument: true,
    optionalSchedulingSupported: true,
  },
  body_temperature: {
    id: 'body_temperature',
    name: 'Temperature',
    shortLabel: 'Temperature',
    bodySystem: 'immune_context',
    canonicalUnit: 'C',
    acceptedUnits: ['C', 'F'],
    timingMode: 'instant',
    entryMode: 'manual',
    methodOptions: ['Oral thermometer', 'Tympanic', 'Axillary', 'Not specified'],
    contextOptions: ['At rest', 'Morning', 'Evening', 'Not specified'],
    purpose:
      'Log oral or site-specific body temperature in °C or °F while preserving entered unit, precision, and site/method.',
    instructions: [
      'Select °C or °F before entering the reading.',
      'Record the measurement site/method when known; incompatible methods remain distinct.',
      'Use the observed mission time.',
    ],
    whyItMatters: {
      text: "Body temperature helps track changes such as fever. Readings can differ depending on where you measure.",
      sourceId: "nlm-temperature",
    },
    spaceflightContext: {
      text: "Early NASA evidence suggests body temperature may rise faster during exercise in low gravity.",
      sourceId: "nasa-body-temperature",
    },
    howToMeasure: {
      text: "Follow your thermometer instructions. Record the result, the unit, and where you measured, such as your mouth or ear.",
      sourceId: "nlm-temperature",
    },
    evidenceIds: ["nist-temperature-units","nasa-standard-measures","nlm-temperature","nasa-body-temperature"],
    supportsUnavailableInstrument: true,
    optionalSchedulingSupported: true,
  },
  sleep: {
    id: 'sleep',
    name: 'Sleep',
    shortLabel: 'Sleep',
    bodySystem: 'sleep_cognition',
    canonicalUnit: 'min',
    acceptedUnits: ['min'],
    timingMode: 'period',
    entryMode: 'self_report',
    methodOptions: ['Self-reported', 'Actigraphy log', 'Not specified'],
    contextOptions: ['Main sleep', 'Nap', 'Other', 'Not specified'],
    purpose:
      'Record sleep duration as a period ending on a mission day, keeping optional sleep windows separate from estimated asleep time.',
    instructions: [
      'Enter hours and whole minutes (0–59) of estimated time asleep.',
      'Entering 0h 0m explicitly logs Reported no sleep; leave blank if unrecorded.',
      'Only compatible Main sleep periods enter the sleep reference.',
    ],
    whyItMatters: {
      text: "Too little sleep can make it harder to stay alert and do your work.",
      sourceId: "nasa-sleep-risk",
    },
    spaceflightContext: {
      text: "Irregular work hours can disrupt sleep during spaceflight.",
      sourceId: "nasa-sleep-risk",
    },
    howToMeasure: {
      text: "Estimate how long you actually slept and record the hours and minutes for that period.",
      sourceId: "nih-sleep-diary",
    },
    evidenceIds: ["nasa-sleep-risk","nasa-seven-ways-sleep","nasa-isolation-standard-measures","nasa-standard-measures","nih-sleep-diary"],
    supportsUnavailableInstrument: false,
    optionalSchedulingSupported: true,
  },
  mood: {
    id: 'mood',
    name: 'Mood',
    shortLabel: 'Mood',
    bodySystem: 'sleep_cognition',
    canonicalUnit: 'ordinal_1_5',
    acceptedUnits: ['ordinal_1_5'],
    timingMode: 'instant',
    entryMode: 'self_report',
    methodOptions: ['Self-reported'],
    contextOptions: ['Routine check-in', 'Post-sleep', 'Not specified'],
    purpose:
      'Capture a custom 1–5 ordinal self-report alongside sleep context without diagnostic interpretation.',
    instructions: [
      'Select one option from 1 Very low to 5 Very good.',
      'Mood starts unselected; no default score is chosen.',
      'Notes are optional and excluded from reports unless selected.',
    ],
    whyItMatters: {
      text: "A mood check records how you feel. NASA studies mood as one sign of crew well-being.",
      sourceId: "nasa-behavioral-measures",
    },
    spaceflightContext: {
      text: "Living and working with the same small crew in a confined space for a long time can affect how people feel and behave.",
      sourceId: "nasa-hrp-hazards",
    },
    howToMeasure: {
      text: "Choose the option that best matches how you feel now. CrewSignal uses its own five choices.",
      sourceId: "nasa-behavioral-measures",
    },
    evidenceIds: ["nasa-isolation-standard-measures","nasa-standard-measures","nasa-behavioral-measures","nasa-hrp-hazards"],
    supportsUnavailableInstrument: false,
    optionalSchedulingSupported: true,
  },
};

export const MEASUREMENT_EDUCATION_SECTIONS = [
  { field: 'whyItMatters', label: 'Why it matters' },
  { field: 'spaceflightContext', label: 'In spaceflight' },
  { field: 'howToMeasure', label: 'How to measure' },
] as const;

export const METRIC_ORDER: readonly MetricId[] = [
  'heart_rate',
  'blood_pressure',
  'blood_glucose',
  'body_temperature',
  'sleep',
  'mood',
] as const;

export const BODY_SYSTEM_DEFINITIONS: readonly BodySystemDefinition[] = [
  {
    id: 'sleep_cognition',
    name: 'Sleep & cognition',
    anchorType: 'head',
    coverageKind: 'self_report',
    coverageLabel: 'Self-reported',
    metricIds: ['sleep', 'mood'],
    summary: 'Self-reported sleep and mood only; cognition is not directly measured.',
    limitation:
      'Self-reported duration and mood ordinal history do not replace cognitive testing or clinical evaluation.',
  },
  {
    id: 'cardiovascular',
    name: 'Cardiovascular',
    anchorType: 'chest',
    coverageKind: 'manual_observation',
    coverageLabel: 'Manual observation',
    metricIds: ['heart_rate', 'blood_pressure'],
    summary:
      'Manual pulse and BP observations; method/context determine comparison eligibility.',
    limitation:
      'Manual spot checks do not provide continuous telemetry or flight-clearance assessment.',
  },
  {
    id: 'musculoskeletal',
    name: 'Musculoskeletal',
    anchorType: 'limb',
    coverageKind: 'not_assessed',
    coverageLabel: 'Not assessed',
    metricIds: [],
    summary: 'Not assessed; no bone-density or muscle-status inference.',
    limitation:
      'Routine prototype inputs contain no musculoskeletal sensor or imaging data.',
  },
  {
    id: 'immune_context',
    name: 'Immune context',
    anchorType: 'whole_body',
    coverageKind: 'context_only',
    coverageLabel: 'Not assessed · Context only',
    metricIds: ['body_temperature'],
    summary:
      'Context only; do not infer immune status from temperature.',
    limitation:
      "This prototype's routine observations do not provide a supported immune assessment.",
  },
  {
    id: 'nutrition_metabolism',
    name: 'Nutrition & metabolism',
    anchorType: 'whole_body',
    coverageKind: 'context_only',
    coverageLabel: 'Whole-body context',
    metricIds: ['blood_glucose'],
    summary:
      'Optional glucose spot entries only; missing data is not overdue or a diagnosis.',
    limitation:
      'Without intake logs or continuous metabolic markers, nutrition and metabolism are not broadly assessed.',
  },
] as const;

/**
 * Strict numeric parser that rejects blank strings, NaN, whitespace garbage,
 * scientific ambiguity, or non-numeric suffixes without coercing blank to 0.
 */
export function parseStrictFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseStrictNonNegativeInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export interface ValidatedDraftOutput {
  validationState: DraftValidationState;
  warning: string | null;
  entered: EnteredObservationValue | null;
  canonical: CanonicalObservationValue | null;
  timing: ObservationTiming | null;
}

export const ENTRY_WARNING_HELP = 'Check the value and unit against the original reading. This is an entry-error check and cannot assess health.';
export const ENTRY_CONFIRMED_NOTE = 'Unusual value confirmed as entered.';

// Broad entry-error guards. Alternate-unit bounds use the same unit conversions as storage.
const entryBounds: Record<string, readonly [number, number]> = {
  bpm: [15, 350],
  'mg/dL': [10, 1500],
  'mmol/L': [convertGlucose(10, 'mg/dL', 'mmol/L').exact, convertGlucose(1500, 'mg/dL', 'mmol/L').exact],
  C: [20, 50],
  F: [convertTemperature(20, 'C', 'F').exact, convertTemperature(50, 'C', 'F').exact],
};

export function getEntryWarning(entered: EnteredObservationValue): string | null {
  if (entered.kind === 'blood_pressure') {
    const { systolic, diastolic } = entered;
    if (systolic <= diastolic) return 'Systolic is equal to or below diastolic. Check the order of the two values.';
    if (systolic < 30 || systolic > 350 || diastolic < 10 || diastolic > 250) {
      return 'This blood pressure pair is outside the entry-check range.';
    }
  }
  if (entered.kind === 'sleep_duration' && entered.durationMinutes > 1440) {
    return 'This sleep duration is longer than 24 hours. Check the hours and minutes.';
  }
  if (entered.kind !== 'scalar') return null;

  const { value, unit } = entered;
  const bounds = entryBounds[unit];
  if (!bounds || (value >= bounds[0] && value <= bounds[1])) return null;
  const alternateUnit = ({ C: 'F', F: 'C', 'mg/dL': 'mmol/L', 'mmol/L': 'mg/dL' } as Record<string, string>)[unit];
  const alternateBounds = alternateUnit && entryBounds[alternateUnit];
  if (alternateBounds && value >= alternateBounds[0] && value <= alternateBounds[1]) {
    const label = alternateUnit === 'C' || alternateUnit === 'F' ? `°${alternateUnit}` : alternateUnit;
    return `This number fits the entry-check range for ${label}. Check the selected unit.`;
  }
  return 'This value is outside the entry-check range for the selected unit.';
}

/**
 * Validates any CheckInDraft before entering Review.
 * Preserves sibling fields and returns field-keyed errors, firstInvalidField,
 * and a concise screen-reader announcement.
 */
export function validateDraftForReview(
  draft: CheckInDraft,
  reportedAtUtcFallback?: string,
): ValidatedDraftOutput {
  const errors: Record<string, string> = {};
  const setErr = (field: string, msg: string) => {
    if (!errors[field]) errors[field] = msg;
  };

  let entered: EnteredObservationValue | null = null;
  let canonical: CanonicalObservationValue | null = null;
  let timing: ObservationTiming | null = null;

  // 1. Validate timing depending on metric timingMode
  if (draft.metricId === 'sleep') {
    const hoursRaw = draft.rawFields.hours ?? '';
    const minsRaw = draft.rawFields.minutes ?? '';

    if (hoursRaw.trim() === '' && minsRaw.trim() === '') {
      setErr('hours', 'Enter sleep hours and minutes (or 0h 0m for no sleep).');
    } else {
      const parsedHours =
        hoursRaw.trim() === '' ? 0 : parseStrictNonNegativeInt(hoursRaw);
      const parsedMins =
        minsRaw.trim() === '' ? 0 : parseStrictNonNegativeInt(minsRaw);

      if (parsedHours === null) {
        setErr('hours', 'Enter whole hours (0 or greater).');
      }
      if (parsedMins === null || parsedMins < 0 || parsedMins > 59) {
        setErr('minutes', 'Minutes must be a whole number from 0 to 59.');
      }

      const endingDayParsed = parseStrictNonNegativeInt(
        draft.rawFields.endingMissionDay ?? '',
      );
      if (endingDayParsed === null || endingDayParsed < 1) {
        setErr('endingMissionDay', 'Enter a valid ending mission day (1 or greater).');
      }

      let windowStartUtc: string | null = null;
      let windowEndUtc: string | null = null;
      if (draft.rawFields.hasSleepWindow) {
        const sDay = parseStrictNonNegativeInt(
          draft.rawFields.windowStartDay ?? '',
        );
        const eDay = parseStrictNonNegativeInt(draft.rawFields.windowEndDay ?? '');
        const sTime = draft.rawFields.windowStartTime ?? '';
        const eTime = draft.rawFields.windowEndTime ?? '';
        if (sDay === null || sDay < 1) {
          setErr('windowStartDay', 'Enter a valid start mission day.');
        }
        if (!parseHHMM(sTime)) {
          setErr('windowStartTime', 'Enter start time in HH:MM format.');
        }
        if (eDay === null || eDay < 1) {
          setErr('windowEndDay', 'Enter a valid end mission day.');
        }
        if (!parseHHMM(eTime)) {
          setErr('windowEndTime', 'Enter end time in HH:MM format.');
        }
        if (
          sDay !== null &&
          sDay >= 1 &&
          eDay !== null &&
          eDay >= 1 &&
          parseHHMM(sTime) &&
          parseHHMM(eTime)
        ) {
          const wResult = validateSleepWindow({
            missionEpochUtc: draft.missionEpochUtc,
            startMissionDay: sDay,
            startTimeHHMM: sTime,
            endMissionDay: eDay,
            endTimeHHMM: eTime,
          });
          if (!wResult.valid) {
            setErr(
              'windowEndDay',
              wResult.error ?? 'End must follow start; confirm the ending day.',
            );
          } else {
            windowStartUtc = wResult.startUtc;
            windowEndUtc = wResult.endUtc;
          }
        }
      }

      if (
        Object.keys(errors).length === 0 &&
        parsedHours !== null &&
        parsedMins !== null &&
        endingDayParsed !== null
      ) {
        const totalMinutes = parsedHours * 60 + parsedMins;
        const reportedUtc =
          draft.observedAtUtc ??
          reportedAtUtcFallback ??
          draft.updatedAtUtc;
        const sleepType: SleepType = draft.rawFields.sleepType ?? 'main_sleep';
        timing = buildPeriodTiming({
          sleepType,
          endingMissionDay: endingDayParsed,
          durationMinutes: totalMinutes,
          reportedAtUtc: reportedUtc,
          missionEpochUtc: draft.missionEpochUtc,
          originalTimezone: draft.originalTimezone,
          windowStartUtc,
          windowEndUtc,
        });
        entered = {
          kind: 'sleep_duration',
          durationMinutes: totalMinutes,
          reportedNoSleep: totalMinutes === 0,
          unit: 'min',
        };
        canonical = {
          ...entered,
          conversionVersion: CONVERSION_RULE_VERSION,
        };
      }
    }
  } else {
    // Instant timing validation
    if (
      draft.observedMissionDay === null ||
      !Number.isInteger(draft.observedMissionDay) ||
      draft.observedMissionDay < 1
    ) {
      setErr('observedMissionDay', 'Enter a valid observed mission day (>= 1).');
    }
    if (!draft.observedTimeHHMM || !parseHHMM(draft.observedTimeHHMM)) {
      setErr('observedTimeHHMM', 'Enter an observed time in 24-hour HH:MM format.');
    }

    if (
      draft.observedMissionDay !== null &&
      draft.observedMissionDay >= 1 &&
      draft.observedTimeHHMM &&
      parseHHMM(draft.observedTimeHHMM)
    ) {
      const resolvedUtc = missionDayAndTimeToUtc(
        draft.missionEpochUtc,
        draft.observedMissionDay,
        draft.observedTimeHHMM,
      );
      timing = buildInstantTiming({
        observedAtUtc: resolvedUtc,
        missionEpochUtc: draft.missionEpochUtc,
        originalTimezone: draft.originalTimezone,
      });
    }

    if (draft.metricId === 'heart_rate') {
      const val = parseStrictFiniteNumber(draft.rawFields.primary);
      if (val === null || val <= 0) {
        setErr('primary', 'Enter a positive resting heart rate in bpm.');
      } else {
        const precision = countDecimalPlaces(draft.rawFields.primary);
        entered = { kind: 'scalar', value: val, unit: 'bpm', precision };
        canonical = {
          ...entered,
          conversionVersion: CONVERSION_RULE_VERSION,
        };
      }
    } else if (draft.metricId === 'blood_pressure') {
      const sys = parseStrictFiniteNumber(draft.rawFields.primary);
      const dia = parseStrictFiniteNumber(draft.rawFields.secondary ?? '');
      if (sys === null || sys <= 0) {
        setErr('primary', 'Enter systolic blood pressure in mmHg.');
      }
      if (dia === null || dia <= 0) {
        setErr('secondary', 'Enter diastolic blood pressure in mmHg.');
      }
      if (sys !== null && sys > 0 && dia !== null && dia > 0) {
        const precision = Math.max(
          countDecimalPlaces(draft.rawFields.primary),
          countDecimalPlaces(draft.rawFields.secondary ?? ''),
        );
        entered = {
          kind: 'blood_pressure',
          systolic: sys,
          diastolic: dia,
          unit: 'mmHg',
          precision,
        };
        canonical = {
          ...entered,
          conversionVersion: CONVERSION_RULE_VERSION,
        };
      }
    } else if (draft.metricId === 'blood_glucose') {
      const val = parseStrictFiniteNumber(draft.rawFields.primary);
      if (val === null || val <= 0) {
        setErr('primary', 'Enter a positive blood glucose reading.');
      } else if (draft.selectedUnit !== 'mg/dL' && draft.selectedUnit !== 'mmol/L') {
        setErr('selectedUnit', 'Choose mg/dL or mmol/L.');
      } else {
        const unit = draft.selectedUnit as GlucoseUnit;
        const precision = countDecimalPlaces(draft.rawFields.primary);
        const normalized = convertGlucose(val, unit, 'mg/dL');
        entered = {
          kind: 'scalar',
          value: val,
          unit,
          precision,
        };
        canonical = {
          kind: 'scalar',
          value: normalized.exact,
          unit: 'mg/dL',
          precision: 3,
          conversionVersion: CONVERSION_RULE_VERSION,
        };
      }
    } else if (draft.metricId === 'body_temperature') {
      const val = parseStrictFiniteNumber(draft.rawFields.primary);
      if (val === null) {
        setErr('primary', 'Enter a numeric body temperature.');
      } else if (draft.selectedUnit !== 'C' && draft.selectedUnit !== 'F') {
        setErr('selectedUnit', 'Choose °C or °F.');
      } else {
        const unit = draft.selectedUnit as TemperatureUnit;
        const precision = countDecimalPlaces(draft.rawFields.primary);
        const normalized = convertTemperature(val, unit, 'C');
        entered = {
          kind: 'scalar',
          value: val,
          unit,
          precision,
        };
        canonical = {
          kind: 'scalar',
          value: normalized.exact,
          unit: 'C',
          precision: 2,
          conversionVersion: CONVERSION_RULE_VERSION,
        };
      }
    } else if (draft.metricId === 'mood') {
      const score = draft.rawFields.moodScore;
      if (
        score === null ||
        (score !== 1 && score !== 2 && score !== 3 && score !== 4 && score !== 5)
      ) {
        setErr('moodScore', 'Choose a rating, or choose another reading.');
      } else {
        const label = getMoodLabel(score);
        entered = {
          kind: 'mood_ordinal',
          score,
          label,
          scaleId: MOOD_SCALE_ID,
          scaleVersion: MOOD_SCALE_VERSION,
          questionText: MOOD_QUESTION_TEXT,
        };
        canonical = {
          ...entered,
          conversionVersion: CONVERSION_RULE_VERSION,
        };
      }
    }
  }

  const keys = Object.keys(errors);
  const valid = keys.length === 0 && entered !== null && canonical !== null && timing !== null;
  const firstInvalidField = keys[0] ?? null;
  const announcement = valid
    ? null
    : firstInvalidField
      ? errors[firstInvalidField] ?? 'Check the highlighted field.'
      : 'Check the highlighted fields.';

  return {
    validationState: {
      valid,
      errors,
      firstInvalidField,
      announcement,
    },
    warning: valid && entered ? getEntryWarning(entered) : null,
    entered: valid ? entered : null,
    canonical: valid ? canonical : null,
    timing: valid ? timing : null,
  };
}

/**
 * Creates a fresh blank CheckInDraft (never pre-populates synthetic demo readings
 * or default mood selections).
 */
export function createBlankDraft(params: {
  draftId: string;
  profileId: string;
  mode: 'demo' | 'personal';
  metricId: MetricId;
  missionEpochUtc: string;
  proposedMissionDay: number;
  proposedTimeHHMM: string;
  nowUtc: string;
  preferredUnit?: string;
}): CheckInDraft {
  const def = METRIC_DEFINITIONS[params.metricId];
  const selectedUnit =
    params.preferredUnit && def.acceptedUnits.includes(params.preferredUnit)
      ? params.preferredUnit
      : def.canonicalUnit;

  const isPeriod = params.metricId === 'sleep';
  const observedAtUtc = missionDayAndTimeToUtc(
    params.missionEpochUtc,
    params.proposedMissionDay,
    params.proposedTimeHHMM,
  );

  return {
    draftId: params.draftId,
    profileId: params.profileId,
    mode: params.mode,
    metricId: params.metricId,
    stage: 'record',
    rawFields: {
      primary: '',
      secondary: params.metricId === 'blood_pressure' ? '' : undefined,
      hours: isPeriod ? '' : undefined,
      minutes: isPeriod ? '' : undefined,
      moodScore: null, // Mood ALWAYS starts unselected
      sleepType: isPeriod ? 'main_sleep' : undefined,
      endingMissionDay: isPeriod ? String(params.proposedMissionDay) : undefined,
      hasSleepWindow: false,
    },
    selectedUnit,
    rawObservedTimeText: `Day ${params.proposedMissionDay} · ${params.proposedTimeHHMM}`,
    observedMissionDay: params.proposedMissionDay,
    observedTimeHHMM: params.proposedTimeHHMM,
    observedAtUtc,
    missionEpochUtc: params.missionEpochUtc,
    originalTimezone: 'UTC',
    method: params.metricId === 'mood' || params.metricId === 'sleep' ? 'Self-reported' : 'Not specified',
    context: params.metricId === 'sleep' ? 'Main sleep' : 'Not specified',
    provenance: def.entryMode === 'self_report' ? 'self_report' : 'manual',
    note: '',
    validationState: {
      valid: false,
      errors: {},
      firstInvalidField: null,
      announcement: null,
    },
    normalizedCandidate: null,
    conversionVersion: CONVERSION_RULE_VERSION,
    retentionStatus: 'retained',
    commitStatus: 'uncommitted',
    committedObservationId: null,
    createdAtUtc: params.nowUtc,
    updatedAtUtc: params.nowUtc,
  };
}

export function getDueMetricSchedules(
  schedules: ProfileConfig['schedules'],
  observations: readonly Observation[],
  referenceNowUtc: string,
) {
  const latestByMetric = getLatestObservationsByMetric(observations);
  return METRIC_ORDER.map((metricId) =>
    evaluateMetricSchedule({
      metricId,
      latestObservation: latestByMetric[metricId] ?? null,
      schedule: schedules[metricId] ?? null,
      referenceNowUtc,
    }),
  ).filter(({ status }) => status === 'due_no_entries' || status === 'past_interval');
}

export function getLatestObservationsByMetric(
  observations: readonly Observation[],
): Record<MetricId, Observation | null> {
  const latest: Record<MetricId, Observation | null> = {
    heart_rate: null,
    blood_pressure: null,
    blood_glucose: null,
    body_temperature: null,
    sleep: null,
    mood: null,
  };

  for (const obs of observations) {
    const current = latest[obs.metricId];
    if (!current) {
      latest[obs.metricId] = obs;
      continue;
    }
    const obsKey =
      obs.timing.kind === 'instant'
        ? Date.parse(obs.timing.observedAtUtc)
        : obs.timing.endingMissionDay * 86_400_000 +
          Date.parse(obs.timing.reportedAtUtc) % 86_400_000;
    const curKey =
      current.timing.kind === 'instant'
        ? Date.parse(current.timing.observedAtUtc)
        : current.timing.endingMissionDay * 86_400_000 +
          Date.parse(current.timing.reportedAtUtc) % 86_400_000;

    if (
      obsKey > curKey ||
      (obsKey === curKey && obs.observationId > current.observationId)
    ) {
      latest[obs.metricId] = obs;
    }
  }
  return latest;
}

export function getDueCheckIns(
  profile: ProfileConfig | null,
  observations: readonly Observation[],
  nowUtc: string,
) {
  return profile ? getDueMetricSchedules(profile.schedules, observations, nowUtc) : [];
}

export function getCheckInReminders(profile: ProfileConfig, observations: readonly Observation[]) {
  const latest = getLatestObservationsByMetric(observations);
  return METRIC_ORDER.flatMap((metricId) => {
    const schedule = profile.schedules[metricId];
    if (!schedule?.enabled) return [];
    const timing = latest[metricId]?.timing;
    const observedAt = timing?.kind === 'instant' ? timing.observedAtUtc : timing?.reportedAtUtc;
    const dueAt = observedAt
      ? Date.parse(observedAt) + (Math.round(schedule.intervalHours * 60) + 0.5) * 60_000
      : Date.parse(schedule.configuredAtUtc);
    if (!Number.isFinite(dueAt)) return [];
    return [{
      id: `crewsignal-check-in:${profile.profileId}:${metricId}:${schedule.configuredAtUtc}:${dueAt}`,
      dueAt,
      title: `${METRIC_DEFINITIONS[metricId].shortLabel} check-in is due`,
    }];
  });
}

export function countCoveredMetricTypes(
  observations: readonly Observation[],
): number {
  const seen = new Set<MetricId>();
  for (const obs of observations) {
    seen.add(obs.metricId);
  }
  return seen.size;
}
