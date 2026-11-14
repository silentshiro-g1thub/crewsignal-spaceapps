import { requestCheckInNotificationPermission } from '../components/ScheduledNotifications';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  METRIC_DEFINITIONS,
  validateManualReference,
  needsManualReferenceConfirmation,
  METRIC_ORDER,
  type AppearancePreference,
  type MetricId,
  type ReferenceValue,
} from '../shared/src';
import {
  ActionButton,
  CalmBanner,
  EyebrowLabel,
  LabeledField,
  PanelCard,
  ScreenTitle,
  SelectableChip,
  StatusBadge,
} from '../components/AppPrimitives';
import { ConfirmDestructiveModal } from '../components/Modals';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';

export function SettingsScreen(): React.ReactElement {
  const { palette, fontSansMedium, fontSansRegular, fontMonoRegular, resolvedMode } =
    useCrewTheme();
  const {
    snapshot,
    activeProfile,
    preferences,
    references,
    setAppearance,
    updatePreferences,
    switchProfile,
    createPersonalProfile,
    updateProfile,
    savePersonalReference,
    resetDemoScenario,
    deletePersonalProfile,
    isOfflineSimulated,
    setOfflineSimulated,
    announce,
    activeOperation,
  } = useCrewSignal();

  const [newProfileLabel, setNewProfileLabel] = useState('');
  const [newProfileMission, setNewProfileMission] = useState('Personal log');
  const [missionNameEdit, setMissionNameEdit] = useState(activeProfile?.missionName ?? '');
  const [epochEdit, setEpochEdit] = useState(activeProfile?.missionEpochUtc ?? '');
  const [refMetric, setRefMetric] = useState<Exclude<MetricId, 'mood'>>('sleep');
  const [refValueText, setRefValueText] = useState('');
  const [refSecondaryText, setRefSecondaryText] = useState('');
  const [refMethod, setRefMethod] = useState('');
  const [refContext, setRefContext] = useState('');
  const [refErrors, setRefErrors] = useState<Record<string,string>>({});
  const [reviewingReferenceId, setReviewingReferenceId] = useState<string | undefined>();
  const [confirmedReference, setConfirmedReference] = useState(false);
  const [savingReference, setSavingReference] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<string | null>(null);
  useEffect(() => setConfirmedReference(false), [refValueText,refSecondaryText,refMethod,refContext]);
  useEffect(() => {
    setRefValueText(''); setRefSecondaryText(''); setRefMethod(''); setRefContext(''); setRefErrors({});
    setReviewingReferenceId(undefined); setConfirmedReference(false); setReferenceStatus(null);
  }, [activeProfile?.profileId, refMetric]);
  const [refNote, setRefNote] = useState('Personal baseline update');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [destructiveMode, setDestructiveMode] = useState<
    null | 'reset_demo' | 'delete_personal'
  >(null);

  if (!snapshot || !activeProfile || !preferences) {
    return (
      <View style={styles.center}>
        <Text style={{ fontFamily: fontSansRegular, color: palette.textSupporting }}>
          Loading Settings…
        </Text>
      </View>
    );
  }

  const handleCreatePersonal = async () => {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const created = await createPersonalProfile({
      label: newProfileLabel.trim() || 'Crew member (Personal)',
      missionName: newProfileMission.trim() || 'Personal log',
      missionEpochUtc: `${todayPrefix}T00:00:00Z`,
      displayTimezone: 'UTC',
    });
    setNewProfileLabel('');
    setStatusMessage(
      `Created blank personal log "${created.label}" using real device clock (0 entries, 0 references).`,
    );
    announce(`Created blank personal log ${created.label}.`);
  };

  const handleSaveClockConfig = async () => {
    await updateProfile({
      ...activeProfile,
      missionName: missionNameEdit.trim() || activeProfile.missionName,
      missionEpochUtc: epochEdit.trim() || activeProfile.missionEpochUtc,
      clockVersion: activeProfile.clockVersion + 1,
    });
    setStatusMessage(
      `Updated mission clock to version ${activeProfile.clockVersion + 1} cleanly.`,
    );
  };

  const handleSaveReferenceVersion = async () => {
    const metricDef = METRIC_DEFINITIONS[refMetric];
    const validation = validateManualReference({metricId:refMetric,primaryText:refValueText,secondaryText:refSecondaryText,method:refMethod,context:refContext,unit:metricDef.canonicalUnit,confirmedPreviousReferenceId:reviewingReferenceId});
    setRefErrors(validation.errors);
    if (!validation.valid || !validation.value || !validation.capture) return;
    if (reviewingReferenceId && !confirmedReference) { setReferenceStatus('Confirm both BP inputs, method and context before creating a replacement version.'); return; }
    if (savingReference) return;
    setSavingReference(true);
    try {
      await savePersonalReference({metricId:refMetric,provenance:'user_updated',method:refMethod,context:refContext,unit:metricDef.canonicalUnit,value:validation.value,manualCapture:validation.capture});
      setRefValueText(''); setRefSecondaryText(''); setRefMethod(''); setRefContext(''); setReviewingReferenceId(undefined);
      setReferenceStatus('Saved new personal reference version.');
    } catch { setReferenceStatus('Reference was not saved. Your entered values are retained; retry when storage is available.'); }
    finally { setSavingReference(false); }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}
    >
      <ScreenTitle
        title="Settings"
        subtitle="Profile mode, mission clock, display units, appearance & scoped reset"
      />

      {referenceStatus ? (
        <CalmBanner title="Personal reference" message={referenceStatus} tone="neutral" />
      ) : null}
      {statusMessage ? (
        <CalmBanner title="Settings updated" message={statusMessage} tone="neutral" />
      ) : null}

      <PanelCard>
        <SelectableChip
          label={preferences.checkInNotifications ? 'Check-in notifications on' : 'Check-in notifications off'}
          selected={preferences.checkInNotifications === true}
          onPress={async () => {
            try {
              const enabled = !preferences.checkInNotifications && await requestCheckInNotificationPermission();
              await updatePreferences({ checkInNotifications: enabled });
              if (!enabled && !preferences.checkInNotifications) setStatusMessage('Notification permission is unavailable.');
            } catch {
              setStatusMessage('Could not change notification settings.');
            }
          }}
        />
      </PanelCard>

      {/* Appearance Switcher — preserves route/draft/selection */}
      <PanelCard testID="settings-appearance-card">
        <View style={{ gap: 10 }}>
          <View style={styles.rowBetween}>
            <EyebrowLabel>Appearance</EyebrowLabel>
            <StatusBadge
              label={`Resolved: ${resolvedMode === 'dark' ? 'Linear Dark' : 'Vercel Light'}`}
              tone="neutral"
            />
          </View>
          <View style={styles.rowWrap}>
            {(['system', 'dark', 'light'] as AppearancePreference[]).map((opt) => (
              <SelectableChip
                key={opt}
                testID={`appearance-${opt}`}
                label={opt === 'system' ? 'System' : opt === 'dark' ? 'Dark' : 'Light'}
                selected={preferences.appearance === opt}
                onPress={() => void setAppearance(opt)}
              />
            ))}
          </View>
        </View>
      </PanelCard>

      {/* Profile Selector & Blank Personal Creation */}
      <PanelCard testID="settings-profiles-card">
        <View style={{ gap: 12 }}>
          <EyebrowLabel>Active mode & profile</EyebrowLabel>
          <View style={styles.rowWrap}>
            {snapshot.profiles.map((p) => (
              <SelectableChip
                key={p.profileId}
                testID={`profile-chip-${p.profileId}`}
                label={`${p.label} (${p.mode === 'demo' ? 'Demo' : 'Personal'})`}
                selected={p.profileId === activeProfile.profileId}
                onPress={() => void switchProfile(p.profileId)}
              />
            ))}
          </View>

          <Text style={{ fontFamily: fontMonoRegular, fontSize: 12, color: palette.textSupporting }}>
            {activeProfile.mode === 'demo'
              ? `Demo snapshot active (${activeProfile.snapshotUtc ?? 'Demo clock'}). Personal data stays strictly separated.`
              : 'Personal log active · Real device clock · Zero synthetic fixtures injected.'}
          </Text>

          <LabeledField
            testID="new-personal-profile-label"
            label="Create new blank personal log"
            value={newProfileLabel}
            placeholder="e.g. Crew personal B"
            onChangeText={setNewProfileLabel}
          />
          <LabeledField
            label="Personal mission label"
            value={newProfileMission}
            placeholder="Personal log"
            onChangeText={setNewProfileMission}
          />
          <ActionButton
            testID="create-personal-profile-btn"
            label="Start blank personal log"
            onPress={() => void handleCreatePersonal()}
            variant="primary"
          />
        </View>
      </PanelCard>

      {/* Display Units (Display only, preserves canonical stored readings) */}
      <PanelCard testID="settings-units-card">
        <View style={{ gap: 12 }}>
          <EyebrowLabel>Display unit preferences</EyebrowLabel>
          <Text style={{ fontFamily: fontSansRegular, fontSize: 13, color: palette.textSupporting }}>
            Changes how saved readings display without overwriting original entered values or units.
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fontSansMedium, fontSize: 14, color: palette.textPrimary }}>
              Blood glucose display unit
            </Text>
            <View style={styles.rowWrap}>
              <SelectableChip
                testID="pref-glucose-mgdl"
                label="mg/dL"
                selected={preferences.displayUnits.blood_glucose === 'mg/dL'}
                onPress={() =>
                  void updatePreferences({
                    displayUnits: {
                      ...preferences.displayUnits,
                      blood_glucose: 'mg/dL',
                    },
                  })
                }
              />
              <SelectableChip
                testID="pref-glucose-mmoll"
                label="mmol/L"
                selected={preferences.displayUnits.blood_glucose === 'mmol/L'}
                onPress={() =>
                  void updatePreferences({
                    displayUnits: {
                      ...preferences.displayUnits,
                      blood_glucose: 'mmol/L',
                    },
                  })
                }
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fontSansMedium, fontSize: 14, color: palette.textPrimary }}>
              Body temperature display unit
            </Text>
            <View style={styles.rowWrap}>
              <SelectableChip
                testID="pref-temp-c"
                label="°C"
                selected={preferences.displayUnits.body_temperature === 'C'}
                onPress={() =>
                  void updatePreferences({
                    displayUnits: {
                      ...preferences.displayUnits,
                      body_temperature: 'C',
                    },
                  })
                }
              />
              <SelectableChip
                testID="pref-temp-f"
                label="°F"
                selected={preferences.displayUnits.body_temperature === 'F'}
                onPress={() =>
                  void updatePreferences({
                    displayUnits: {
                      ...preferences.displayUnits,
                      body_temperature: 'F',
                    },
                  })
                }
              />
            </View>
          </View>
        </View>
      </PanelCard>

      {/* Mission Clock Versioning */}
      <PanelCard>
        <View style={{ gap: 10 }}>
          <EyebrowLabel>{`Mission clock config (v${activeProfile.clockVersion})`}</EyebrowLabel>
          <LabeledField
            label="Mission name"
            value={missionNameEdit}
            onChangeText={setMissionNameEdit}
          />
          <LabeledField
            label="Mission Day 1 epoch (UTC ISO)"
            value={epochEdit}
            onChangeText={setEpochEdit}
          />
          <ActionButton
            label="Save clock version"
            onPress={() => void handleSaveClockConfig()}
            variant="secondary"
          />
        </View>
      </PanelCard>

      {/* Versioned Personal References */}
      <PanelCard testID="settings-references-card">
        <View style={{ gap: 10 }}>
          <EyebrowLabel>Personal references (versioned)</EyebrowLabel>
          <View style={styles.rowWrap}>
            {METRIC_ORDER.filter(
              (m): m is Exclude<MetricId, 'mood'> => m !== 'mood',
            ).map((m) => (
              <SelectableChip
                key={m}
                label={METRIC_DEFINITIONS[m].shortLabel}
                selected={refMetric === m}
                onPress={() => setRefMetric(m)}
              />
            ))}
          </View>
          <LabeledField testID="reference-primary" label={refMetric === 'blood_pressure' ? 'Systolic' : 'Reference value'} unitLabel={METRIC_DEFINITIONS[refMetric].canonicalUnit} keyboardType="decimal-pad" value={refValueText} onChangeText={setRefValueText} errorText={refErrors.primary} />
          {refMetric === 'blood_pressure' ? <LabeledField testID="reference-secondary" label="Diastolic" unitLabel="mmHg" keyboardType="decimal-pad" value={refSecondaryText} onChangeText={setRefSecondaryText} errorText={refErrors.secondary} /> : null}
          <EyebrowLabel>Measurement method (required)</EyebrowLabel>
          <View style={styles.rowWrap}>{METRIC_DEFINITIONS[refMetric].methodOptions.filter(x=>x!=='Not specified').map(x=><SelectableChip key={x} label={x} selected={refMethod===x} onPress={()=>setRefMethod(x)} />)}</View>
          {refErrors.method ? <Text accessibilityRole="alert">{refErrors.method}</Text> : null}
          <EyebrowLabel>Measurement context (required)</EyebrowLabel>
          <View style={styles.rowWrap}>{METRIC_DEFINITIONS[refMetric].contextOptions.filter(x=>x!=='Not specified').map(x=><SelectableChip key={x} label={x} selected={refContext===x} onPress={()=>setRefContext(x)} />)}</View>
          {refErrors.context ? <Text accessibilityRole="alert">{refErrors.context}</Text> : null}
          {reviewingReferenceId ? <View><Text>Review saved reference {reviewingReferenceId}. Verify both BP inputs, method and context.</Text><SelectableChip label="I verified both BP inputs, method and context" selected={confirmedReference} onPress={()=>setConfirmedReference(!confirmedReference)} /></View> : null}
          <LabeledField
            label="Reference source note"
            value={refNote}
            onChangeText={setRefNote}
          />
          <ActionButton
            testID="save-reference" disabled={savingReference} label="Create new reference version"
            onPress={() => void handleSaveReferenceVersion()}
            variant="secondary"
          />

          {references.filter(r=>r.metricId===refMetric).map(r=><View key={r.referenceId}><Text>{r.label} · {r.status} · {JSON.stringify(r.value)} {r.unit} · {r.method} · {r.context}</Text>
            {needsManualReferenceConfirmation(r) ? <Text>Needs confirmation before comparison</Text> : null}
            {needsManualReferenceConfirmation(r) && r.value?.kind==='blood_pressure' ? <ActionButton label="Review previous BP values" onPress={()=>{if(r.value?.kind!=='blood_pressure')return;setRefValueText(String(r.value.systolic));setRefSecondaryText(String(r.value.diastolic));setRefMethod(r.method);setRefContext(r.context);setReviewingReferenceId(r.referenceId);setConfirmedReference(false);}} variant="secondary" /> : null}</View>)}
          <Text style={{ fontFamily: fontMonoRegular, fontSize: 12, color: palette.textSupporting }}>
            {`Stored versions in active profile: ${references.length} (${references.filter((r) => r.status === 'active').length} active, ${references.filter((r) => r.status === 'superseded').length} superseded)`}
          </Text>
        </View>
      </PanelCard>

      {/* Connectivity & Help Mode */}
      <PanelCard>
        <View style={{ gap: 10 }}>
          <EyebrowLabel>Local offline simulation & Help fixture</EyebrowLabel>
          <View style={styles.rowWrap}>
            <SelectableChip
              label={isOfflineSimulated ? 'Offline mode: On' : 'Offline mode: Off'}
              selected={isOfflineSimulated}
              onPress={() => setOfflineSimulated(!isOfflineSimulated)}
            />
            <SelectableChip
              label={
                preferences.helpMode === 'configured_fixture'
                  ? 'Help: Test fixture'
                  : 'Help: Unconfigured'
              }
              selected={preferences.helpMode === 'configured_fixture'}
              onPress={() =>
                void updatePreferences({
                  helpMode:
                    preferences.helpMode === 'configured_fixture'
                      ? 'unconfigured'
                      : 'configured_fixture',
                })
              }
            />
          </View>
        </View>
      </PanelCard>

      {/* Scoped Demo Reset vs Personal Profile Deletion */}
      <PanelCard testID="settings-danger-zone">
        <View style={{ gap: 10 }}>
          <EyebrowLabel>Scoped data controls</EyebrowLabel>
          {activeProfile.mode === 'demo' ? (
            <ActionButton
              testID="reset-demo-btn"
              label={`Reset demo scenario (${activeProfile.label})`}
              onPress={() => setDestructiveMode('reset_demo')}
              disabled={activeOperation !== null}
              variant="danger"
            />
          ) : (
            <ActionButton
              testID="delete-personal-btn"
              label={`Delete personal profile (${activeProfile.label})`}
              onPress={() => setDestructiveMode('delete_personal')}
              disabled={activeOperation !== null}
              variant="danger"
            />
          )}
        </View>
      </PanelCard>

      <ConfirmDestructiveModal
        visible={destructiveMode !== null}
        title={
          destructiveMode === 'reset_demo'
            ? 'Reset synthetic demo scenario?'
            : 'Delete this personal profile?'
        }
        message={
          destructiveMode === 'reset_demo'
            ? `Resets only "${activeProfile.label}" to the synthetic baseline fixture. Any personal profiles on this device remain untouched.`
            : `Permanently removes "${activeProfile.label}" and all its observations, drafts, events, and references from local SQLite storage.`
        }
        confirmLabel={
          destructiveMode === 'reset_demo' ? 'Reset demo data' : 'Delete personal log'
        }
        onConfirm={() => {
          const mode = destructiveMode;
          setDestructiveMode(null);
          if (mode === 'reset_demo') {
            void resetDemoScenario(activeProfile.profileId);
          } else if (mode === 'delete_personal') {
            void deletePersonalProfile(activeProfile.profileId);
          }
        }}
        onCancel={() => setDestructiveMode(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
