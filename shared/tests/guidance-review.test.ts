import { describe, expect, it } from 'vitest';
import { buildSleepInsight, guidanceReviewIdentity, isInsightReviewCurrent, markInsightReviewed, SIM_01_SLEEP_OBSERVATIONS, SIM_01_REFERENCES, SIM_01_SNAPSHOT_UTC } from '../src';
const current = () => buildSleepInsight({ observation: SIM_01_SLEEP_OBSERVATIONS[6]!, reference: SIM_01_REFERENCES.find(r => r.metricId === 'sleep')!, createdAtUtc: SIM_01_SNAPSHOT_UTC })!;
describe('Complete educational acknowledgement identity', () => {
  it('is deterministic under source reordering and repeated confirmation', () => {
    const value = { ...current(), sourceIds: ['b', 'a'], sourceVersions: { b: 'v2', a: 'v1' } };
    const reviewed = markInsightReviewed(value, SIM_01_SNAPSHOT_UTC);
    expect(isInsightReviewCurrent(reviewed, { ...value, sourceIds: ['a', 'b'], sourceVersions: { a: 'v1', b: 'v2' } })).toBe(true);
    expect(markInsightReviewed(value, SIM_01_SNAPSHOT_UTC).insightId).toBe(reviewed.insightId);
  });
  it.each([
    ['profile', { profileId: 'other-profile' }], ['observation', { observationId: 'other-observation' }],
    ['reference ID', { referenceId: 'other-reference' }], ['reference version', { referenceVersion: 99 }],
    ['rule ID', { ruleId: 'other-rule' }], ['rule version', { ruleVersion: 'v99' }],
    ['source addition', { sourceIds: ['new-source'], sourceVersions: { 'new-source': 'v1' } }],
  ])('invalidates a change in %s', (_, patch) => {
    const value = current(); const reviewed = markInsightReviewed(value, SIM_01_SNAPSHOT_UTC);
    const changed = { ...value, ...patch };
    expect(isInsightReviewCurrent(reviewed, changed)).toBe(false);
    expect(guidanceReviewIdentity(changed)).not.toBe(guidanceReviewIdentity(value));
  });
  it('invalidates every cited source independently and retains the original tuple', () => {
    const value = current(); const reviewed = markInsightReviewed(value, SIM_01_SNAPSHOT_UTC);
    for (const id of value.sourceIds) {
      const changed = { ...value, sourceVersions: { ...value.sourceVersions, [id]: 'new summary' } };
      expect(isInsightReviewCurrent(reviewed, changed)).toBe(false);
      expect(markInsightReviewed(changed, SIM_01_SNAPSHOT_UTC).insightId).not.toBe(reviewed.insightId);
    }
    expect(isInsightReviewCurrent(reviewed, value)).toBe(true);
  });
  it('rejects incomplete review identities and skips insights without a reference', () => {
    const value = current(); const reviewed = markInsightReviewed(value, SIM_01_SNAPSHOT_UTC);
    expect(isInsightReviewCurrent({ ...reviewed, sourceVersions: {} }, value)).toBe(false);
    expect(isInsightReviewCurrent({ ...reviewed, sourceIds: [] }, value)).toBe(false);
    expect(isInsightReviewCurrent({ ...reviewed, referenceId: undefined }, value)).toBe(false);
    expect(isInsightReviewCurrent({ ...reviewed, profileId: undefined }, value)).toBe(false);
    expect(() => markInsightReviewed({ ...value, sourceVersions: {} }, SIM_01_SNAPSHOT_UTC)).toThrow();
    const generated = buildSleepInsight({ observation: SIM_01_SLEEP_OBSERVATIONS[6]!, reference: null, createdAtUtc: SIM_01_SNAPSHOT_UTC });
    expect(generated).toBeNull();
  });
});
