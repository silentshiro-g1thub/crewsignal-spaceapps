import { describe, expect, it } from 'vitest';
import {
  ACTION_CONTENT_REGISTRY,
  CONFIGURED_HELP_TEST_FIXTURE,
  CONVERSION_RULE_VERSION,
  DEFAULT_UNCONFIGURED_HELP,
  EVIDENCE_CHECKED_DATE,
  EVIDENCE_LIST,
  MF_01_FIXTURE,
  SIM_01_EPOCH_UTC,
  SIM_01_OBSERVATIONS,
  SIM_01_PROFILE,
  SIM_01_PROFILE_ID,
  SIM_01_REFERENCES,
  SIM_01_SLEEP_OBSERVATIONS,
  SIM_01_SNAPSHOT_UTC,
  buildInstantTiming,
  buildPeriodTiming,
  buildRaiseReadingPrompt,
  buildReportBundle,
  buildSleepInsight,
  compareObservationToReference,
  createNewReferenceVersion,
  deriveSevenDayFallbackReference,
  describeMissionContact,
  isInsightReviewCurrent,
  markInsightReviewed,
  resolveActiveReference,
  resolveHelpContent,
  selectFallbackReferenceToLock,
  type Observation,
} from '../src/index';

function makeHrObs(
  id: string,
  day: number,
  hhmm: string,
  bpm: number,
  recordedAtUtc: string,
  method = 'Manual pulse count',
): Observation {
  const dateDay = 6 + day; // day 1 = Oct 3; day 30..36 etc. Use missionDay math via date:
  const ms = Date.parse(SIM_01_EPOCH_UTC) + (day - 1) * 86_400_000;
  const [hh, mm] = hhmm.split(':').map(Number);
  const obsIso = new Date(ms + (hh! * 60 + mm!) * 60_000)
    .toISOString()
    .replace('.000Z', 'Z');
  void dateDay;
  return {
    observationId: id,
    profileId: 'test-prof',
    metricId: 'heart_rate',
    timing: buildInstantTiming({
      observedAtUtc: obsIso,
      missionEpochUtc: SIM_01_EPOCH_UTC,
    }),
    recordedAtUtc,
    entered: { kind: 'scalar', value: bpm, unit: 'bpm', precision: 0 },
    canonical: {
      kind: 'scalar',
      value: bpm,
      unit: 'bpm',
      precision: 0,
      conversionVersion: CONVERSION_RULE_VERSION,
    },
    method,
    context: 'At rest',
    provenance: 'manual',
    quality: 'valid',
    qualityNote: null,
    note: null,
    sourceDraftId: null,
    importBatchId: null,
    correctionHistory: [],
  };
}

describe('Consider raising this', () => {
  const profileId = 'test-prof';
  const references = SIM_01_REFERENCES.map((r) => ({ ...r, profileId }));
  const hr = (day: number, bpm = 90, method?: string, time = '07:00') =>
    makeHrObs(`hr-${day}-${time}`, day, time, bpm, SIM_01_SNAPSHOT_UTC, method);
  const evaluate = (observations: Observation[]) => buildRaiseReadingPrompt({ profileId, observations, references });

  it('identifies three consecutive days and opens a report scoped to the exact readings', () => {
    const readings = [hr(40), hr(41), { ...hr(42), note: 'Private note' }];
    const mood = { ...SIM_01_OBSERVATIONS.find((o) => o.metricId === 'mood')!, profileId };
    const observations = [hr(42, 72, undefined, '06:00'), mood, ...[...readings].reverse()];
    const prompt = evaluate(observations)!;
    expect(prompt.ruleVersion).toBe('crewsignal-raise-reading-v1');
    expect(prompt.reasons).toEqual(['sustained']);
    expect(prompt.readings).toHaveLength(3);
    expect(prompt.readings.every((r) => r.referenceVersion === 1)).toBe(true);
    expect(prompt.reportScope.observationIds).toEqual(readings.map((r) => r.observationId));

    const report = buildReportBundle({
      profile: { ...SIM_01_PROFILE, profileId },
      observations,
      references,
      startDay: prompt.reportScope.startDay,
      endDay: prompt.reportScope.endDay,
      selectedMetricIds: prompt.reportScope.metricIds,
      selectedObservationIds: prompt.reportScope.observationIds,
      generatedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(report.observations.map((r) => r.observationId).sort()).toEqual(readings.map((r) => r.observationId).sort());
    expect(report.observations.every((r) => r.note === null)).toBe(true);
    expect(report.excludedMetricIds).toContain('mood');
  });

  it('identifies multiple indicators differing on the same observed day', () => {
    const sleep = { ...SIM_01_SLEEP_OBSERVATIONS[6]!, profileId };
    const prompt = evaluate([hr(42), sleep]);
    expect(prompt?.reasons).toEqual(['multiple']);
    expect(prompt?.reportScope.observationIds).toEqual(expect.arrayContaining([hr(42).observationId, sleep.observationId]));
    expect(evaluate([hr(41), sleep])).toBeNull();
  });

  it('stays hidden for isolated differences, gaps, and incompatible measurements', () => {
    expect(evaluate([hr(42)])).toBeNull();
    expect(evaluate([hr(39), hr(41), hr(42)])).toBeNull();
    expect(evaluate([hr(40), hr(41, 90, 'Not specified'), hr(42)])).toBeNull();
  });

  it('requires a stored, compatible reference for the active profile', () => {
    const observations = [hr(40), hr(41), hr(42)];
    expect(buildRaiseReadingPrompt({ profileId, observations, references: [] })).toBeNull();
    expect(buildRaiseReadingPrompt({ profileId, observations, references: SIM_01_REFERENCES })).toBeNull();
    expect(buildRaiseReadingPrompt({ profileId, observations, references: references.map((r) => ({ ...r, locked: false })) })).toBeNull();
  });

  it('requires an explicit link to an agreeing repeat before using a flagged reading', () => {
    const flagged: Observation = { ...hr(42, 90, undefined, '06:00'), quality: 'questionable' };
    const repeat = hr(42, 88);
    const rechecks = [{ flaggedObservationId: flagged.observationId, repeatObservationId: repeat.observationId }];
    expect(evaluate([flagged, repeat])).toBeNull();
    expect(buildRaiseReadingPrompt({ profileId, references, observations: [flagged, repeat], rechecks })?.reasons).toEqual(['recheck']);
    expect(buildRaiseReadingPrompt({ profileId, references, observations: [flagged, hr(42, 55)], rechecks })).toBeNull();
  });

  it('labels the example contact route and explains when Help has no route', () => {
    expect(describeMissionContact('unconfigured')).toMatch(/No mission contact route is configured/);
    expect(describeMissionContact('configured_fixture')).toMatch(/test fixture only/);
  });
});

describe('Personal reference lifecycle & 7-day fallback heuristic', () => {
  it('compares SIM-01 sleep and resting HR against entered preflight references', () => {
    const day42Sleep = SIM_01_SLEEP_OBSERVATIONS[6]!;
    const sleepRef = SIM_01_REFERENCES.find((r) => r.metricId === 'sleep')!;
    const sleepCmp = compareObservationToReference(day42Sleep, sleepRef);
    expect(sleepCmp.comparisonAvailable).toBe(true);
    expect(sleepCmp.deltaNumeric).toBe(-96);
    expect(sleepCmp.differenceText).toBe('1h 36m below reference');

    const hrObs = SIM_01_OBSERVATIONS.find((o) => o.metricId === 'heart_rate')!;
    const hrRef = SIM_01_REFERENCES.find((r) => r.metricId === 'heart_rate')!;
    const hrCmp = compareObservationToReference(hrObs, hrRef);
    expect(hrCmp.comparisonAvailable).toBe(true);
    expect(hrCmp.deltaNumeric).toBe(8);
    expect(hrCmp.differenceText).toBe('+8 bpm from reference');
  });

  it('marks MF-01 unknown-method HR as Comparison unavailable rather than comparing incompatible methods', () => {
    const hrRef = SIM_01_REFERENCES.find((r) => r.metricId === 'heart_rate')!;
    const mf01Obs: Observation = {
      observationId: 'obs-mf01-test',
      profileId: SIM_01_PROFILE_ID,
      metricId: 'heart_rate',
      timing: buildInstantTiming({
        observedAtUtc: '2026-11-13T07:18:00Z',
        missionEpochUtc: SIM_01_EPOCH_UTC,
      }),
      recordedAtUtc: '2026-11-13T07:18:00Z',
      entered: { kind: 'scalar', value: 72, unit: 'bpm', precision: 0 },
      canonical: {
        kind: 'scalar',
        value: 72,
        unit: 'bpm',
        precision: 0,
        conversionVersion: CONVERSION_RULE_VERSION,
      },
      method: MF_01_FIXTURE.draft.method,
      context: MF_01_FIXTURE.draft.context,
      provenance: 'manual',
      quality: 'valid',
      qualityNote: null,
      note: null,
      sourceDraftId: null,
      importBatchId: null,
      correctionHistory: [],
    };

    const cmp = compareObservationToReference(mf01Obs, hrRef);
    expect(cmp.comparisonAvailable).toBe(false);
    expect(cmp.unavailableReason).toBe('A compatible method is not known.');
  });

  it('derives 7-day fallback median using earliest observed instant + deterministic ID tie-breaker', () => {
    const obs: Observation[] = [
      // Day 1: two readings at same instant -> 'hr-d1-a' beats 'hr-d1-b' deterministically
      makeHrObs('hr-d1-b', 1, '07:00', 99, '2026-11-13T10:00:00Z'),
      makeHrObs('hr-d1-a', 1, '07:00', 60, '2026-11-13T11:00:00Z'),
      // Day 2: earlier observed 06:30 (62) beats later 09:00 (80) even if recorded later
      makeHrObs('hr-d2-late', 2, '09:00', 80, '2026-10-04T09:01:00Z'),
      makeHrObs('hr-d2-early', 2, '06:30', 62, '2026-11-12T12:00:00Z'),
      makeHrObs('hr-d3', 3, '07:00', 64, '2026-10-05T07:01:00Z'),
      makeHrObs('hr-d4', 4, '07:00', 66, '2026-10-06T07:01:00Z'),
      makeHrObs('hr-d5', 5, '07:00', 68, '2026-10-07T07:01:00Z'),
      makeHrObs('hr-d6', 6, '07:00', 70, '2026-10-08T07:01:00Z'),
      // Incompatible method should be excluded
      makeHrObs('hr-d7-bad', 7, '07:00', 120, '2026-10-09T07:01:00Z', 'Not specified'),
      makeHrObs('hr-d7', 7, '07:10', 72, '2026-10-09T07:11:00Z'),
      // Day 8 should not shift locked 7-day starting reference
      makeHrObs('hr-d8', 8, '07:00', 110, '2026-10-10T07:01:00Z'),
    ];

    const ref = deriveSevenDayFallbackReference({
      profileId: 'test-prof',
      metricId: 'heart_rate',
      method: 'Manual pulse count',
      context: 'At rest',
      observations: obs,
      createdAtUtc: SIM_01_SNAPSHOT_UTC,
    });

    expect(ref.status).toBe('active');
    expect(ref.locked).toBe(true);
    expect(ref.distinctObservedDays).toBe(7);
    expect(ref.selectedObservationIds).toContain('hr-d1-a');
    expect(ref.selectedObservationIds).toContain('hr-d2-early');
    expect(ref.selectedObservationIds).not.toContain('hr-d7-bad');
    expect(ref.selectedObservationIds).not.toContain('hr-d8');
    // Median of [60, 62, 64, 66, 68, 70, 72] = 66
    expect(ref.value).toEqual({ kind: 'scalar', value: 66 });
  });

  it('flags ambiguous multi-period main sleep days and keeps Nap periods out of sleep fallback', () => {
    const baseDays = [1, 2, 3, 4, 5, 6].map(
      (day): Observation => ({
        observationId: `sl-d${day}`,
        profileId: 'p1',
        metricId: 'sleep',
        timing: buildPeriodTiming({
          sleepType: 'main_sleep',
          endingMissionDay: day,
          durationMinutes: 420,
          reportedAtUtc: `2026-10-0${day + 2}T07:00:00Z`,
          missionEpochUtc: SIM_01_EPOCH_UTC,
        }),
        recordedAtUtc: `2026-10-0${day + 2}T07:00:00Z`,
        entered: {
          kind: 'sleep_duration',
          durationMinutes: 420,
          reportedNoSleep: false,
          unit: 'min',
        },
        canonical: {
          kind: 'sleep_duration',
          durationMinutes: 420,
          reportedNoSleep: false,
          unit: 'min',
          conversionVersion: CONVERSION_RULE_VERSION,
        },
        method: 'Self-reported',
        context: 'Main sleep',
        provenance: 'self_report',
        quality: 'valid',
        qualityNote: null,
        note: null,
        sourceDraftId: null,
        importBatchId: null,
        correctionHistory: [],
      }),
    );

    const ambiguousDay7: Observation[] = [
      {
        ...baseDays[0]!,
        observationId: 'sl-d7-a',
        timing: buildPeriodTiming({
          sleepType: 'main_sleep',
          endingMissionDay: 7,
          durationMinutes: 360,
          reportedAtUtc: '2026-10-09T07:00:00Z',
          missionEpochUtc: SIM_01_EPOCH_UTC,
        }),
      },
      {
        ...baseDays[0]!,
        observationId: 'sl-d7-b',
        timing: buildPeriodTiming({
          sleepType: 'main_sleep',
          endingMissionDay: 7,
          durationMinutes: 390,
          reportedAtUtc: '2026-10-09T08:00:00Z',
          missionEpochUtc: SIM_01_EPOCH_UTC,
        }),
      },
      // Nap on day 8 must NOT satisfy main_sleep coverage
      {
        ...baseDays[0]!,
        observationId: 'sl-d8-nap',
        timing: buildPeriodTiming({
          sleepType: 'nap',
          endingMissionDay: 8,
          durationMinutes: 45,
          reportedAtUtc: '2026-10-10T15:00:00Z',
          missionEpochUtc: SIM_01_EPOCH_UTC,
        }),
      },
    ];

    const unresolved = deriveSevenDayFallbackReference({
      profileId: 'p1',
      metricId: 'sleep',
      method: 'Self-reported',
      context: 'Main sleep',
      observations: [...baseDays, ...ambiguousDay7],
      createdAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(unresolved.status).toBe('unavailable');
    expect(unresolved.ambiguousDays).toEqual([7]);

    const resolved = deriveSevenDayFallbackReference({
      profileId: 'p1',
      metricId: 'sleep',
      method: 'Self-reported',
      context: 'Main sleep',
      observations: [...baseDays, ...ambiguousDay7],
      createdAtUtc: SIM_01_SNAPSHOT_UTC,
      sleepDayRepresentatives: { 7: 'sl-d7-b' },
    });
    expect(resolved.status).toBe('active');
    expect(resolved.distinctObservedDays).toBe(7);
  });

  it('creates new locked reference versions while keeping previous versions as superseded history', () => {
    const updated = createNewReferenceVersion({
      existingReferences: SIM_01_REFERENCES,
      profileId: SIM_01_PROFILE_ID,
      metricId: 'sleep',
      provenance: 'user_updated',
      method: 'Self-reported',
      context: 'Main sleep',
      unit: 'min',
      value: { kind: 'sleep_duration', durationMinutes: 450 },
      createdAtUtc: SIM_01_SNAPSHOT_UTC,
    });

    const sleepRefs = updated.filter((r) => r.metricId === 'sleep');
    expect(sleepRefs).toHaveLength(2);
    expect(sleepRefs.find((r) => r.version === 1)?.status).toBe('superseded');
    expect(sleepRefs.find((r) => r.version === 2)?.status).toBe('active');
  });
});

describe('Controlled guidance, evidence registry, and Help registry', () => {
  it('bundles the reviewed November 13 and 14 source inventory with cached summaries', () => {
    const original = ['nasa-sleep-risk', 'nasa-seven-ways-sleep', 'nasa-standard-measures',
      'nasa-hrp-hazards', 'nasa-human-research-roadmap', 'nasa-isolation-standard-measures',
      'cdc-nhanes-glucose', 'nist-temperature-units'];
    const added = ['nlm-pulse', 'aha-blood-pressure', 'nasa-standing-risk', 'fda-glucose-meter',
      'nasa-human-adaptation', 'nlm-temperature', 'nasa-body-temperature', 'nih-sleep-diary',
      'nasa-behavioral-measures'];
    expect(EVIDENCE_LIST.map(src => src.sourceId).sort()).toEqual([...original, ...added].sort());
    for (const src of EVIDENCE_LIST) {
      expect(src.checkedDate).toBe(original.includes(src.sourceId) ? EVIDENCE_CHECKED_DATE : '2026-11-14');
      expect(src.cachedAvailable).toBe(true);
      expect(src.summaryText.length).toBeGreaterThan(20);
      expect(src.limitations.length).toBeGreaterThan(15);
    }
    expect(
      ACTION_CONTENT_REGISTRY['action-clinical-procedure-slot']?.enabled,
    ).toBe(false);
  });

  it('pins sleep insights to input/reference/rule/source versions and limits review acknowledgement to that exact version', () => {
    const day42Sleep = SIM_01_SLEEP_OBSERVATIONS[6]!;
    const sleepRef = SIM_01_REFERENCES.find((r) => r.metricId === 'sleep')!;
    const insight = buildSleepInsight({
      observation: day42Sleep,
      reference: sleepRef,
      createdAtUtc: SIM_01_SNAPSHOT_UTC,
    });

    if (!insight) throw new Error('Expected a sleep insight');
    const reviewed = markInsightReviewed(insight, SIM_01_SNAPSHOT_UTC);
    expect(isInsightReviewCurrent(reviewed, insight)).toBe(true);

    // Newer observation invalidates prior review acknowledgement
    const newerObs: Observation = {
      ...day42Sleep,
      observationId: 'obs-sim01-sleep-d43',
    };
    const newerInsight = buildSleepInsight({
      observation: newerObs,
      reference: sleepRef,
      createdAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    if (!newerInsight) throw new Error('Expected an insight for the newer reading');
    expect(isInsightReviewCurrent(reviewed, newerInsight)).toBe(false);
  });

  it('provides unconfigured Help by default and clearly marked Example procedure card test fixture', () => {
    const unconfigured = resolveHelpContent('unconfigured');
    expect(unconfigured).toEqual(DEFAULT_UNCONFIGURED_HELP);
    expect(unconfigured.statusTitle).toBe('Mission-specific guidance not configured');

    const fixtureHelp = resolveHelpContent('configured_fixture');
    expect(fixtureHelp).toEqual(CONFIGURED_HELP_TEST_FIXTURE);
    expect(fixtureHelp.fixtureBanner).toBe('Example procedure card · Test fixture');
  });
});

describe('Review P1: seven-day fallback lock is persisted once and survives later data', () => {
  const sleepObs = (day: number, minutes: number, dateIso: string): Observation => ({
    ...SIM_01_SLEEP_OBSERVATIONS[0]!,
    observationId: `obs-test-sleep-d${day}-${minutes}`,
    timing: buildPeriodTiming({
      sleepType: 'main_sleep',
      endingMissionDay: day,
      durationMinutes: minutes,
      reportedAtUtc: `${dateIso}T07:04:00Z`,
      missionEpochUtc: SIM_01_EPOCH_UTC,
    }),
    recordedAtUtc: `${dateIso}T07:04:00Z`,
    entered: { kind: 'sleep_duration', durationMinutes: minutes, reportedNoSleep: false, unit: 'min' },
    canonical: {
      ...(SIM_01_SLEEP_OBSERVATIONS[0]!.canonical as Extract<Observation['canonical'], { kind: 'sleep_duration' }>),
      durationMinutes: minutes,
    },
  });

  const lockNow = () =>
    selectFallbackReferenceToLock({
      profileId: SIM_01_PROFILE_ID,
      metricId: 'sleep',
      references: [],
      observations: SIM_01_SLEEP_OBSERVATIONS,
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });

  it('selects the first eligible method/context with its representative observation IDs', () => {
    const locked = lockNow();
    expect(locked).not.toBeNull();
    expect(locked!.status).toBe('active');
    expect(locked!.locked).toBe(true);
    expect(locked!.value).toEqual({ kind: 'sleep_duration', durationMinutes: 408 });
    expect(locked!.selectedObservationIds).toHaveLength(7);
    expect(locked!.referenceId).toBe(`ref-${SIM_01_PROFILE_ID}-sleep-fallback-v1`);
  });

  it('a stored lock is reused after later observations and earlier imports', () => {
    const locked = lockNow()!;
    const later = [...SIM_01_SLEEP_OBSERVATIONS, sleepObs(43, 300, '2026-11-14')];
    const earlier = [sleepObs(30, 520, '2026-11-01'), sleepObs(31, 510, '2026-11-02'), ...later];
    for (const observations of [later, earlier]) {
      expect(
        selectFallbackReferenceToLock({
          profileId: SIM_01_PROFILE_ID,
          metricId: 'sleep',
          references: [locked],
          observations,
          nowUtc: SIM_01_SNAPSHOT_UTC,
        }),
      ).toBeNull();
      const resolved = resolveActiveReference({
        profileId: SIM_01_PROFILE_ID,
        metricId: 'sleep',
        references: [locked],
        observations,
        referenceMethod: 'Self-reported',
        referenceContext: 'Main sleep',
        nowUtc: SIM_01_SNAPSHOT_UTC,
      });
      expect(resolved).toEqual(locked);
    }
  });

  it('an explicit update creates an active version 2 and keeps the superseded fallback', () => {
    const locked = lockNow()!;
    const next = createNewReferenceVersion({
      existingReferences: [locked],
      profileId: SIM_01_PROFILE_ID,
      metricId: 'sleep',
      provenance: 'user_updated',
      method: 'Self-reported',
      context: 'Main sleep',
      unit: 'min',
      value: { kind: 'sleep_duration', durationMinutes: 420 },
      createdAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(next).toHaveLength(2);
    expect(next[0]!.status).toBe('superseded');
    expect(next[0]!.selectedObservationIds).toEqual(locked.selectedObservationIds);
    expect(next[1]!.status).toBe('active');
    expect(next[1]!.version).toBe(2);
    expect(
      selectFallbackReferenceToLock({
        profileId: SIM_01_PROFILE_ID,
        metricId: 'sleep',
        references: next,
        observations: SIM_01_SLEEP_OBSERVATIONS,
        nowUtc: SIM_01_SNAPSHOT_UTC,
      }),
    ).toBeNull();
  });

  it('does nothing with fewer than seven days or when SIM-01 already has entered references', () => {
    expect(
      selectFallbackReferenceToLock({
        profileId: SIM_01_PROFILE_ID,
        metricId: 'sleep',
        references: [],
        observations: SIM_01_SLEEP_OBSERVATIONS.slice(1),
        nowUtc: SIM_01_SNAPSHOT_UTC,
      }),
    ).toBeNull();
    for (const metricId of ['heart_rate', 'blood_pressure', 'blood_glucose', 'body_temperature', 'sleep', 'mood'] as const) {
      expect(
        selectFallbackReferenceToLock({
          profileId: SIM_01_PROFILE_ID,
          metricId,
          references: SIM_01_REFERENCES,
          observations: SIM_01_OBSERVATIONS,
          nowUtc: SIM_01_SNAPSHOT_UTC,
        }),
      ).toBeNull();
    }
  });
});
