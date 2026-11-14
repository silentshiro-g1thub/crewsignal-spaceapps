import { describe, expect, it } from 'vitest';
import {
  MOOD_QUESTION_TEXT,
  MOOD_SCALE_ID,
  SIM_01_EPOCH_UTC,
  SIM_01_OBSERVATIONS,
  SIM_01_PREFERENCES,
  SIM_01_PROFILE_ID,
  SIM_01_SNAPSHOT_UTC,
  SIM_SCHEDULE_OBSERVATIONS,
  getDueCheckIns,
  getCheckInReminders,
  SIM_SCHEDULE_PROFILE,
  type Observation,
  applyInputUnitChange,
  celsiusToFahrenheit,
  computeAgeMinutes,
  computeMissionDay,
  convertGlucose,
  convertTemperature,
  createBlankDraft,
  evaluateMetricSchedule,
  fahrenheitToCelsius,
  formatDurationHoursMinutes,
  formatObservationDisplay,
  formatReviewEquivalent,
  mgDlToMmolL,
  mmolLToMgDl,
  planInputUnitChange,
  validateDraftForReview,
  validateSleepWindow,
} from '../src/index';

describe('Unit conversions, display preferences, and populated input-unit confirmation', () => {
  it('converts glucose exactly with mmol/L * 18.02 and reciprocal', () => {
    expect(mmolLToMgDl(5.4)).toBe(97.308);
    expect(mgDlToMmolL(97.308)).toBe(5.4);

    const rev = formatReviewEquivalent('blood_glucose', 5.4, 'mmol/L');
    expect(rev).not.toBeNull();
    expect(rev?.exact).toBe(97.308);
    expect(rev?.rounded1).toBe(97.3);
    expect(rev?.label).toBe('Equivalent (approx.): 97.3 mg/dL');

    const roundTrip = convertGlucose(97.308, 'mg/dL', 'mmol/L');
    expect(roundTrip.exact).toBe(5.4);
  });

  it('converts temperature with exact NIST Celsius/Fahrenheit equations', () => {
    expect(celsiusToFahrenheit(36.7)).toBe(98.06);
    expect(fahrenheitToCelsius(98.06)).toBe(36.7);

    const rev = formatReviewEquivalent('body_temperature', 36.7, 'C');
    expect(rev?.exact).toBe(98.06);
    expect(rev?.rounded1).toBe(98.1);
    expect(rev?.label).toBe('Equivalent: 98.1 °F');

    const conv = convertTemperature(36.7, 'C', 'F');
    expect(conv.exact).toBe(98.06);
    expect(conv.rounded1).toBe(98.1);
  });

  it('requires confirmation before changing unit of populated input and never silently reinterprets digits', () => {
    let draft = createBlankDraft({
      draftId: 'draft-glu-1',
      profileId: SIM_01_PROFILE_ID,
      mode: 'demo',
      metricId: 'blood_glucose',
      missionEpochUtc: SIM_01_EPOCH_UTC,
      proposedMissionDay: 42,
      proposedTimeHHMM: '07:18',
      nowUtc: SIM_01_SNAPSHOT_UTC,
      preferredUnit: 'mmol/L',
    });

    // Empty field changes unit without confirmation
    const emptyPlan = planInputUnitChange('', 'mmol/L', 'mg/dL');
    expect(emptyPlan.requiresConfirmation).toBe(false);

    // Populated field requires confirmation
    draft = {
      ...draft,
      rawFields: { ...draft.rawFields, primary: '5.4' },
      method: 'Fingerstick meter',
      context: 'Fasting',
      note: 'keep note',
    };
    const validated = validateDraftForReview(draft);
    draft = { ...draft, normalizedCandidate: validated.canonical };

    const popPlan = planInputUnitChange('5.4', 'mmol/L', 'mg/dL');
    expect(popPlan.requiresConfirmation).toBe(true);
    expect(popPlan.dialogTitle).toBe('Change input unit?');

    // Canceling retains every field intact
    const canceled = applyInputUnitChange(draft, 'mg/dL', false, SIM_01_SNAPSHOT_UTC);
    expect(canceled).toEqual(draft);
    expect(canceled.rawFields.primary).toBe('5.4');
    expect(canceled.selectedUnit).toBe('mmol/L');
    expect(canceled.normalizedCandidate).not.toBeNull();

    // Confirming clears ONLY numeric value & old normalizedCandidate
    const confirmed = applyInputUnitChange(draft, 'mg/dL', true, SIM_01_SNAPSHOT_UTC);
    expect(confirmed.selectedUnit).toBe('mg/dL');
    expect(confirmed.rawFields.primary).toBe('');
    expect(confirmed.normalizedCandidate).toBeNull();
    expect(confirmed.observedTimeHHMM).toBe('07:18');
    expect(confirmed.method).toBe('Fingerstick meter');
    expect(confirmed.context).toBe('Fasting');
    expect(confirmed.note).toBe('keep note');
    expect(confirmed.draftId).toBe('draft-glu-1');
  });

  it('applies display unit preferences without mutating stored Observation records', () => {
    const tempObs = SIM_01_OBSERVATIONS.find((o) => o.metricId === 'body_temperature')!;
    const snapshotBefore = JSON.stringify(tempObs);

    const displayF = formatObservationDisplay(tempObs, {
      blood_glucose: 'mg/dL',
      body_temperature: 'F',
    });
    expect(displayF.primaryText).toBe('98.1 °F');
    expect(displayF.enteredText).toBe('36.7 °C');
    expect(displayF.isConvertedDisplay).toBe(true);
    expect(JSON.stringify(tempObs)).toBe(snapshotBefore);
  });
});

describe('Mission day timing, schedule freshness, sleep period, mood, and BP validation', () => {
  it('derives mission day from configured UTC epoch (2026-10-03 -> Day 42 on 2026-11-13)', () => {
    expect(computeMissionDay('2026-10-03T00:00:00Z', SIM_01_EPOCH_UTC)).toBe(1);
    expect(computeMissionDay('2026-11-07T07:04:00Z', SIM_01_EPOCH_UTC)).toBe(36);
    expect(computeMissionDay(SIM_01_SNAPSHOT_UTC, SIM_01_EPOCH_UTC)).toBe(42);
  });

  it('computes SIM-SCHEDULE BP age as 26h 18m against a 24h interval', () => {
    const bpObs = SIM_SCHEDULE_OBSERVATIONS[0]!;
    const now = SIM_SCHEDULE_PROFILE.snapshotUtc!;
    expect(getDueCheckIns(SIM_SCHEDULE_PROFILE, SIM_SCHEDULE_OBSERVATIONS, now))
      .toEqual([expect.objectContaining({ metricId: 'blood_pressure', status: 'past_interval' })]);
    expect(getDueCheckIns(SIM_SCHEDULE_PROFILE, [], now))
      .toEqual([expect.objectContaining({ metricId: 'blood_pressure', status: 'due_no_entries' })]);
    expect(getCheckInReminders(SIM_SCHEDULE_PROFILE, SIM_SCHEDULE_OBSERVATIONS))
      .toEqual([expect.objectContaining({ title: 'Blood pressure check-in is due' })]);
    const disabled = { ...SIM_SCHEDULE_PROFILE, schedules: { ...SIM_SCHEDULE_PROFILE.schedules, blood_pressure: null } };
    expect(getCheckInReminders(disabled, SIM_SCHEDULE_OBSERVATIONS)).toEqual([]);
    expect(getDueCheckIns(disabled, SIM_SCHEDULE_OBSERVATIONS, now)).toEqual([]);
    const ageMins = computeAgeMinutes(
      bpObs.timing.kind === 'instant' ? bpObs.timing.observedAtUtc : '',
      SIM_01_SNAPSHOT_UTC,
    );
    expect(ageMins).toBe(26 * 60 + 18);
    expect(formatDurationHoursMinutes(ageMins)).toBe('26h 18m');

    const scheduleResult = evaluateMetricSchedule({
      metricId: 'blood_pressure',
      latestObservation: bpObs,
      schedule: SIM_SCHEDULE_PROFILE.schedules.blood_pressure,
      referenceNowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(scheduleResult.status).toBe('past_interval');
    expect(scheduleResult.ageLabel).toBe('26h 18m');
    expect(scheduleResult.intervalLabel).toBe('24h');
  });

  it('validates sleep windows crossing midnight without replacing estimated duration, and distinguishes 0h0m vs blank', () => {
    // Invalid window: Day 41 23:00 to Day 41 22:00
    const badWin = validateSleepWindow({
      missionEpochUtc: SIM_01_EPOCH_UTC,
      startMissionDay: 41,
      startTimeHHMM: '23:00',
      endMissionDay: 41,
      endTimeHHMM: '22:00',
    });
    expect(badWin.valid).toBe(false);
    expect(badWin.error).toBe('End must follow start; confirm the ending day.');

    // Valid window crossing midnight: Day 41 23:00 to Day 42 05:00 = 6h (360 min)
    const goodWin = validateSleepWindow({
      missionEpochUtc: SIM_01_EPOCH_UTC,
      startMissionDay: 41,
      startTimeHHMM: '23:00',
      endMissionDay: 42,
      endTimeHHMM: '05:00',
    });
    expect(goodWin.valid).toBe(true);
    expect(goodWin.windowMinutes).toBe(360);

    // Draft with 5h 48m estimated asleep + 6h window preserves 348 minutes
    const sleepDraft = createBlankDraft({
      draftId: 'draft-sleep-win',
      profileId: SIM_01_PROFILE_ID,
      mode: 'demo',
      metricId: 'sleep',
      missionEpochUtc: SIM_01_EPOCH_UTC,
      proposedMissionDay: 42,
      proposedTimeHHMM: '07:04',
      nowUtc: '2026-11-13T07:04:00Z',
    });
    sleepDraft.rawFields.hours = '5';
    sleepDraft.rawFields.minutes = '48';
    sleepDraft.rawFields.hasSleepWindow = true;
    sleepDraft.rawFields.windowStartDay = '41';
    sleepDraft.rawFields.windowStartTime = '23:00';
    sleepDraft.rawFields.windowEndDay = '42';
    sleepDraft.rawFields.windowEndTime = '05:00';

    const validatedSleep = validateDraftForReview(sleepDraft);
    expect(validatedSleep.validationState.valid).toBe(true);
    expect(validatedSleep.canonical?.kind).toBe('sleep_duration');
    if (validatedSleep.canonical?.kind === 'sleep_duration') {
      expect(validatedSleep.canonical.durationMinutes).toBe(348);
      expect(validatedSleep.canonical.reportedNoSleep).toBe(false);
    }
    expect(validatedSleep.timing?.kind).toBe('period');
    if (validatedSleep.timing?.kind === 'period') {
      expect(validatedSleep.timing.endingMissionDay).toBe(42);
      expect(validatedSleep.timing.windowStartMissionDay).toBe(41);
      expect(validatedSleep.timing.windowEndMissionDay).toBe(42);
    }

    // Blank sleep stays invalid/missing (not coerced to 0)
    const blankSleep = createBlankDraft({
      draftId: 'draft-sleep-blank',
      profileId: SIM_01_PROFILE_ID,
      mode: 'demo',
      metricId: 'sleep',
      missionEpochUtc: SIM_01_EPOCH_UTC,
      proposedMissionDay: 42,
      proposedTimeHHMM: '07:04',
      nowUtc: '2026-11-13T07:04:00Z',
    });
    expect(validateDraftForReview(blankSleep).validationState.valid).toBe(false);

    // Explicit 0h 0m is valid Reported no sleep
    const zeroSleep = {
      ...blankSleep,
      rawFields: { ...blankSleep.rawFields, hours: '0', minutes: '0' },
    };
    const zeroRes = validateDraftForReview(zeroSleep);
    expect(zeroRes.validationState.valid).toBe(true);
    if (zeroRes.canonical?.kind === 'sleep_duration') {
      expect(zeroRes.canonical.durationMinutes).toBe(0);
      expect(zeroRes.canonical.reportedNoSleep).toBe(true);
    }
  });

  it('starts mood unselected and rejects Review until a rating is chosen; preserves BP systolic on missing diastolic (ER-01)', () => {
    const moodDraft = createBlankDraft({
      draftId: 'draft-mood-1',
      profileId: SIM_01_PROFILE_ID,
      mode: 'demo',
      metricId: 'mood',
      missionEpochUtc: SIM_01_EPOCH_UTC,
      proposedMissionDay: 42,
      proposedTimeHHMM: '07:18',
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(moodDraft.rawFields.moodScore).toBeNull();
    const unselected = validateDraftForReview(moodDraft);
    expect(unselected.validationState.valid).toBe(false);
    expect(unselected.validationState.errors.moodScore).toBe(
      'Choose a rating, or choose another reading.',
    );

    const selected = validateDraftForReview({
      ...moodDraft,
      rawFields: { ...moodDraft.rawFields, moodScore: 3 },
    });
    expect(selected.validationState.valid).toBe(true);
    if (selected.canonical?.kind === 'mood_ordinal') {
      expect(selected.canonical.scaleId).toBe(MOOD_SCALE_ID);
      expect(selected.canonical.questionText).toBe(MOOD_QUESTION_TEXT);
      expect(selected.canonical.label).toBe('Neutral');
    }

    // ER-01: BP systolic 118, missing diastolic
    const bpDraft = createBlankDraft({
      draftId: 'draft-bp-er01',
      profileId: SIM_01_PROFILE_ID,
      mode: 'demo',
      metricId: 'blood_pressure',
      missionEpochUtc: SIM_01_EPOCH_UTC,
      proposedMissionDay: 42,
      proposedTimeHHMM: '07:18',
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    bpDraft.rawFields.primary = '118';
    bpDraft.rawFields.secondary = '';
    const bpRes = validateDraftForReview(bpDraft);
    expect(bpRes.validationState.valid).toBe(false);
    expect(bpRes.validationState.firstInvalidField).toBe('secondary');
    expect(bpDraft.rawFields.primary).toBe('118');
  });

  it('pads non-zero sleep minutes to two digits (426 min -> 7h 06m) while keeping Reported no sleep as 0h 0m', () => {
    const day38Sleep = SIM_01_OBSERVATIONS.find((o) => o.observationId === 'obs-sim01-sleep-d38')!;
    const day38Display = formatObservationDisplay(day38Sleep, SIM_01_PREFERENCES.displayUnits);
    expect(day38Display.primaryText).toBe('7h 06m');
    expect(day38Display.valueOnlyText).toBe('7h 06m');
    expect(day38Display.enteredText).toBe('7h 06m');

    const zeroSleepObs: Observation = {
      ...day38Sleep,
      observationId: 'test-sleep-zero',
      entered: {
        kind: 'sleep_duration',
        durationMinutes: 0,
        reportedNoSleep: true,
        unit: 'min',
      },
      canonical: {
        kind: 'sleep_duration',
        durationMinutes: 0,
        reportedNoSleep: true,
        unit: 'min',
        conversionVersion: 'crewsignal-units-v1',
      },
    };
    const zeroDisplay = formatObservationDisplay(zeroSleepObs, SIM_01_PREFERENCES.displayUnits);
    expect(zeroDisplay.primaryText).toBe('0h 0m');
    expect(zeroDisplay.valueOnlyText).toBe('0h 0m');
    expect(zeroDisplay.unitLabel).toBe('Reported no sleep');
    expect(zeroDisplay.enteredText).toBe('Reported no sleep (0h 0m)');
  });
});
