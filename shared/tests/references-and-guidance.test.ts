import { describe, expect, it } from 'vitest';
import {
  ACTION_CONTENT_REGISTRY,
  CONFIGURED_HELP_TEST_FIXTURE,
  CONVERSION_RULE_VERSION,
  DEFAULT_UNCONFIGURED_HELP,
  EVIDENCE_CHECKED_DATE,
  EVIDENCE_LIST,
  EVIDENCE_REGISTRY,
  BODY_SYSTEM_RESEARCH,
  MEASUREMENT_RESEARCH,
  MISSION_RESEARCH_SOURCE_IDS,
  RADIATION_RESEARCH,
  METRIC_ORDER,
  MF_01_FIXTURE,
  SIM_01_EPOCH_UTC,
  SIM_01_OBSERVATIONS,
  SIM_01_PROFILE,
  SIM_01_PROFILE_ID,
  SIM_01_REFERENCES,
  SIM_01_SLEEP_OBSERVATIONS,
  SIM_01_SNAPSHOT_UTC,
  buildInstantTiming,
  buildMetricInsight,
  buildPeriodTiming,
  buildRaiseReadingPrompt,
  buildReportBundle,
  buildSleepInsight,
  compareObservationToReference,
  createNewReferenceVersion,
  deriveSevenDayFallbackReference,
  describeMissionContact,
  getMetricAction,
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
  it.each(METRIC_ORDER)('provides a sourced next step for %s', (metricId) => {
    const action = getMetricAction(metricId);
    expect(action.enabled).toBe(true);
    expect(action.steps).not.toHaveLength(0);
    expect(action.applicability).toBeTruthy();
    expect(action.limitation).toBeTruthy();
    expect(action.sourceIds).not.toHaveLength(0);
    for (const sourceId of action.sourceIds) {
      expect(EVIDENCE_REGISTRY[sourceId]?.relatedMetricIds).toContain(metricId);
      expect(EVIDENCE_REGISTRY[sourceId]?.relatedActionIds).toContain(action.actionId);
    }
  });

  const glucose: Observation = {
    ...makeHrObs('guidance-glucose', 42, '07:00', 90, SIM_01_SNAPSHOT_UTC),
    metricId: 'blood_glucose',
    entered: { kind: 'scalar', value: 90, unit: 'mg/dL', precision: 0 },
    canonical: { kind: 'scalar', value: 90, unit: 'mg/dL', precision: 0, conversionVersion: CONVERSION_RULE_VERSION },
    method: 'Fingerstick meter',
  };

  it.each([...SIM_01_OBSERVATIONS, glucose].filter((observation, index, all) =>
    all.findIndex((other) => other.metricId === observation.metricId) === index,
  ))('checks comparison eligibility for $metricId', (observation) => {
    const metricId = observation.metricId;
    const params = { observation, reference: null, createdAtUtc: SIM_01_SNAPSHOT_UTC };
    expect(buildMetricInsight(metricId, params)).toBeNull();
    if (observation.canonical.kind === 'mood_ordinal' || metricId === 'mood') return;

    const value = observation.canonical;
    const reference = {
      ...SIM_01_REFERENCES[0]!,
      referenceId: `guidance-reference-${metricId}`,
      profileId: observation.profileId,
      metricId,
      method: observation.method,
      context: observation.context,
      unit: value.kind === 'scalar' ? value.unit : value.kind === 'blood_pressure' ? 'mmHg' : 'min',
      value,
    };
    const insight = buildMetricInsight(metricId, { ...params, reference });
    expect(insight).toMatchObject({
      observationId: observation.observationId,
      referenceId: reference.referenceId,
      referenceVersion: reference.version,
      ruleVersion: getMetricAction(metricId).ruleVersion,
      comparisonAvailable: true,
    });
    if (!insight) throw new Error(`Missing ${metricId} insight`);
    const reviewed = markInsightReviewed(insight, SIM_01_SNAPSHOT_UTC);
    expect(isInsightReviewCurrent(reviewed, insight)).toBe(true);
    expect(isInsightReviewCurrent(reviewed, { ...insight, referenceId: 'other-reference' })).toBe(false);
    expect(buildMetricInsight(metricId, { ...params, reference: { ...reference, method: 'Another method' } })).toBeNull();
    expect(buildMetricInsight(metricId, { ...params, reference: { ...reference, profileId: 'other-profile' } })).toBeNull();
    expect(buildMetricInsight(metricId, { ...params, observation: { ...observation, quality: 'questionable' }, reference })).toBeNull();
  });

  it('bundles the original, measurement-education, and mission research sources with cached summaries', () => {
    expect(EVIDENCE_LIST.filter((src) => src.checkedDate === EVIDENCE_CHECKED_DATE)).toHaveLength(8);
    expect(EVIDENCE_LIST.filter((src) => src.checkedDate === '2026-11-14')).toHaveLength(13);
    expect(EVIDENCE_LIST).toHaveLength(21);
    for (const src of EVIDENCE_LIST) {
      expect(src.cachedAvailable).toBe(true);
      expect(src.summaryText.length).toBeGreaterThan(20);
      expect(src.limitations.length).toBeGreaterThan(15);
    }
    expect(
      ACTION_CONTENT_REGISTRY['action-clinical-procedure-slot']?.enabled,
    ).toBe(false);
  });

  it('bundles the five mission research links and resolves every research card', () => {
    const expected = {
      'nasa-hrp-hazards': 'https://www.nasa.gov/hrp/hazards/',
      'nasa-hrp-risks': 'https://www.nasa.gov/hrp/risks/',
      'nasa-ongoing-hrp-research': 'https://www.nasa.gov/hrp/ongoing-hrp-research/',
      'csa-radiation-monitoring': 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
      'csa-iss-experiments': 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
    };
    expect(MISSION_RESEARCH_SOURCE_IDS).toEqual(Object.keys(expected));
    for (const [id, url] of Object.entries(expected)) {
      expect(EVIDENCE_REGISTRY[id]).toMatchObject({ sourceId: id, url, cachedAvailable: true, summaryVersion: 'Version 1' });
    }
    expect(EVIDENCE_REGISTRY['nasa-human-research-roadmap']?.url).toBe('https://humanresearchroadmap.nasa.gov/risks/');
    for (const context of [...Object.values(BODY_SYSTEM_RESEARCH), ...Object.values(MEASUREMENT_RESEARCH), RADIATION_RESEARCH]) {
      expect(EVIDENCE_REGISTRY[context.sourceId]?.cachedAvailable).toBe(true);
      expect(context.text).toBeTruthy();
    }
    expect(Object.keys(MEASUREMENT_RESEARCH)).toHaveLength(6);
  });

  it('preserves synthetic sleep and BP comparisons and default report scope with research cards enabled', () => {
    const bp = SIM_01_OBSERVATIONS.find((row) => row.metricId === 'blood_pressure')!;
    const sleep = SIM_01_SLEEP_OBSERVATIONS[6]!;
    const sleepReference = SIM_01_REFERENCES.find((row) => row.metricId === 'sleep')!;
    expect(compareObservationToReference(sleep, sleepReference).comparisonAvailable).toBe(true);
    expect(compareObservationToReference(bp, null).comparisonAvailable).toBe(false);

    const report = buildReportBundle({
      profile: SIM_01_PROFILE,
      observations: SIM_01_OBSERVATIONS,
      references: SIM_01_REFERENCES,
      startDay: 1,
      endDay: 42,
      generatedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(report.includedMetricIds).toEqual(['heart_rate', 'blood_pressure', 'body_temperature', 'sleep']);
    expect(report.includeNotes).toBe(false);
    expect(report.observations.map((row) => row.observationId)).toEqual(expect.arrayContaining([sleep.observationId, bp.observationId]));
    expect(report.evidence.map((source) => source.sourceId)).not.toContain(RADIATION_RESEARCH.sourceId);
    expect(report.evidence.map((source) => source.sourceId)).not.toContain(MEASUREMENT_RESEARCH.sleep.sourceId);
    expect(report.evidence.map((source) => source.sourceId)).not.toContain(MEASUREMENT_RESEARCH.blood_pressure.sourceId);
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
    expect(insight.insightId).toBe(`insight-${day42Sleep.observationId}-refv1-crewsignal-sleep-guidance-v1`);
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
