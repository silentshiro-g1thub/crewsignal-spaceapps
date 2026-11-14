import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EVIDENCE_CHECKED_DATE,
  METRIC_DEFINITIONS,
  type MetricId,
} from '../shared/src';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';
import { ActionButton, LabeledField, PanelCard, SelectableChip } from './AppPrimitives';

function ModalBackdropFrame({
  visible,
  onRequestClose,
  title,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { palette, fontSansMedium } = useCrewTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: palette.modalBackdrop },
        ]}
      >
        <PanelCard
          style={[
            styles.dialog,
            {
              backgroundColor: palette.surfacePanel,
              borderColor: palette.borderControl,
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fontSansMedium,
                fontSize: 20,
                lineHeight: 26,
                color: palette.textPrimary,
              }}
            >
              {title}
            </Text>
            {children}
          </ScrollView>
        </PanelCard>
      </View>
    </Modal>
  );
}

export function UnitChangeModal(): React.ReactElement | null {
  const { palette, fontSansRegular, fontMonoRegular } = useCrewTheme();
  const { unitChangeModal, confirmUnitChange, cancelUnitChange } = useCrewSignal();
  if (!unitChangeModal) return null;

  return (
    <ModalBackdropFrame
      visible
      onRequestClose={cancelUnitChange}
      title={`Switch input unit to ${unitChangeModal.nextUnit}?`}
    >
      <Text
        style={{
          fontFamily: fontSansRegular,
          fontSize: 15,
          lineHeight: 22,
          color: palette.textBody,
        }}
      >
        You already typed {unitChangeModal.currentRaw} {unitChangeModal.currentUnit}. Choose whether to convert this value or clear the field before changing units.
      </Text>

      <PanelCard raised>
        <Text
          style={{
            fontFamily: fontMonoRegular,
            fontSize: 13,
            color: palette.textPrimary,
          }}
        >
          {`Preview conversion: ${unitChangeModal.currentRaw} ${unitChangeModal.currentUnit} -> ${unitChangeModal.convertedPreview} ${unitChangeModal.nextUnit}`}
        </Text>
      </PanelCard>

      <View style={{ gap: 10 }}>
        <ActionButton
          testID="unit-change-convert"
          label={`Convert to ${unitChangeModal.convertedPreview} ${unitChangeModal.nextUnit}`}
          onPress={() => void confirmUnitChange('convert')}
          variant="primary"
          fullWidth
        />
        <ActionButton
          testID="unit-change-clear"
          label={`Clear value & switch to ${unitChangeModal.nextUnit}`}
          onPress={() => void confirmUnitChange('clear')}
          variant="secondary"
          fullWidth
        />
        <ActionButton
          testID="unit-change-cancel"
          label="Cancel"
          onPress={cancelUnitChange}
          variant="subtle"
          fullWidth
        />
      </View>
    </ModalBackdropFrame>
  );
}

export function MeasurementHelpModal({
  visible,
  metricId,
  onClose,
  onOpenSources,
  onOpenResearch,
}: {
  visible: boolean;
  metricId: MetricId;
  onClose: () => void;
  onOpenSources: () => void;
  onOpenResearch: () => void;
}): React.ReactElement | null {
  const { palette, fontSansRegular, fontSansMedium, fontMonoRegular } = useCrewTheme();
  if (!visible) return null;
  const def = METRIC_DEFINITIONS[metricId];

  const guideByMetric: Record<MetricId, { protocol: string; sourceTitle: string }> = {
    heart_rate: {
      protocol:
        'Measure at rest after sitting quietly for 5 minutes when possible. Choosing "Not specified" stays valid for logging, while personal reference comparison may show unavailable until posture and method match.',
      sourceTitle: 'NASA Standard Measures & Resting Pulse Protocol',
    },
    blood_pressure: {
      protocol:
        'Sit upright with arm supported at heart level and cuff matched to arm size. Enter both systolic and diastolic together in mmHg so the reading stays complete.',
      sourceTitle: 'NASA Cardiovascular Standard Measures',
    },
    blood_glucose: {
      protocol:
        'Record value from glucometer and pick the exact instrument unit (mg/dL or mmol/L). Specify fasting or post-meal context when known.',
      sourceTitle: 'CDC NHANES 2021–2022 GLU-L-MET-508 Summary',
    },
    body_temperature: {
      protocol:
        'Record oral, tympanic, or infrared sensor temperature using the device unit (°C or °F).',
      sourceTitle: 'NIST ITS-90 Temperature Unit Conversion Rules',
    },
    sleep: {
      protocol:
        'Record estimated time asleep (e.g. 5h 48m or 0h 0m if reporting no sleep). Bed/wake times across midnight (e.g. 23:00 to 05:00) do not overwrite your typed estimated asleep time.',
      sourceTitle: 'NASA HRP Risk from Inadequate Sleep',
    },
    mood: {
      protocol:
        'Select one explicit 1–5 mood level ("How is your mood right now?"). No value is pre-selected.',
      sourceTitle: 'CrewSignal Behavioral Self-Report Scale (v1)',
    },
  };

  const info = guideByMetric[metricId];

  return (
    <ModalBackdropFrame
      visible={visible}
      onRequestClose={onClose}
      title={`${def.name} — Measurement help`}
    >
      <Text
        style={{
          fontFamily: fontMonoRegular,
          fontSize: 12,
          color: palette.textSupporting,
        }}
      >
        {`OFFLINE REFERENCE SUMMARY · CHECKED ${EVIDENCE_CHECKED_DATE}`}
      </Text>

      <Text
        style={{
          fontFamily: fontSansRegular,
          fontSize: 15,
          lineHeight: 22,
          color: palette.textBody,
        }}
      >
        {info.protocol}
      </Text>

      <PanelCard raised>
        <Text
          style={{
            fontFamily: fontSansMedium,
            fontSize: 14,
            color: palette.textPrimary,
          }}
        >
          {info.sourceTitle}
        </Text>
        <Text
          style={{
            fontFamily: fontSansRegular,
            fontSize: 13,
            lineHeight: 19,
            color: palette.textSupporting,
            marginTop: 4,
          }}
        >
          Loaded offline inside CrewSignal. External browser links are optional and never auto-opened from Check-in.
        </Text>
      </PanelCard>

      <View style={{ gap: 10 }}>
        <ActionButton
          label="View measurement research"
          onPress={() => {
            onClose();
            onOpenResearch();
          }}
          variant="secondary"
          fullWidth
        />
        <ActionButton
          label="Open offline Sources summary"
          onPress={() => {
            onClose();
            onOpenSources();
          }}
          variant="secondary"
          fullWidth
        />
        <ActionButton
          label="Close"
          onPress={onClose}
          variant="primary"
          fullWidth
        />
      </View>
    </ModalBackdropFrame>
  );
}

export function SkipOrUnavailableModal({
  visible,
  mode,
  hasDraftData,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  mode: 'skip' | 'unavailable';
  hasDraftData: boolean;
  onClose: () => void;
  onSubmit: (params: { reason: string; keepDraft: boolean }) => void;
}): React.ReactElement | null {
  const { palette, fontSansRegular } = useCrewTheme();
  const [reason, setReason] = useState(
    mode === 'unavailable' ? 'Instrument unavailable' : '',
  );
  const [keepDraft, setKeepDraft] = useState(true);

  if (!visible) return null;

  return (
    <ModalBackdropFrame
      visible={visible}
      onRequestClose={onClose}
      title={mode === 'unavailable' ? 'Measurement unavailable' : 'Skip this check-in'}
    >
      <Text
        style={{
          fontFamily: fontSansRegular,
          fontSize: 15,
          lineHeight: 22,
          color: palette.textBody,
        }}
      >
        {mode === 'unavailable'
          ? 'Records a workflow attempt event without storing a fake numeric reading or erasing past log entries.'
          : 'Ends this check-in calmly without committing blank measurements to your log.'}
      </Text>

      <LabeledField
        label={mode === 'unavailable' ? 'Reason (optional)' : 'Skip note (optional)'}
        value={reason}
        onChangeText={setReason}
        placeholder={mode === 'unavailable' ? 'e.g. Sensor calibrating' : 'e.g. Operational task'}
      />

      {hasDraftData ? (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontFamily: fontSansRegular,
              fontSize: 13,
              color: palette.textSupporting,
            }}
          >
            Uncommitted draft handling:
          </Text>
          <View style={styles.chipRow}>
            <SelectableChip
              label="Keep open draft"
              selected={keepDraft}
              onPress={() => setKeepDraft(true)}
            />
            <SelectableChip
              label="Discard open draft"
              selected={!keepDraft}
              onPress={() => setKeepDraft(false)}
            />
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <ActionButton
          testID="confirm-skip-unavailable"
          label={mode === 'unavailable' ? 'Record unavailable' : 'Skip check-in'}
          onPress={() => onSubmit({ reason, keepDraft: hasDraftData ? keepDraft : false })}
          variant="primary"
          fullWidth
        />
        <ActionButton label="Cancel" onPress={onClose} variant="subtle" fullWidth />
      </View>
    </ModalBackdropFrame>
  );
}

export function ConfirmDestructiveModal({
  visible,
  title,
  message,
  confirmLabel,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled = false,
  secondaryActionTestID,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionDisabled?: boolean;
  secondaryActionTestID?: string;
  /** Holds the destructive action off while a related operation is in flight. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content between the message and the actions (e.g. a consent choice). */
  children?: React.ReactNode;
}): React.ReactElement | null {
  const { palette, fontSansRegular } = useCrewTheme();
  if (!visible) return null;

  return (
    <ModalBackdropFrame visible={visible} onRequestClose={onCancel} title={title}>
      <Text
        style={{
          fontFamily: fontSansRegular,
          fontSize: 15,
          lineHeight: 22,
          color: palette.textBody,
        }}
      >
        {message}
      </Text>
      {children}
      <View style={{ gap: 10 }}>
        {secondaryActionLabel && onSecondaryAction ? (
          <ActionButton
            testID={secondaryActionTestID}
            label={secondaryActionLabel}
            disabled={secondaryActionDisabled}
            onPress={onSecondaryAction}
            variant="secondary"
            fullWidth
          />
        ) : null}
        <ActionButton
          testID="confirm-destructive-action"
          label={confirmLabel}
          disabled={confirmDisabled}
          onPress={onConfirm}
          variant="danger"
          fullWidth
        />
        <ActionButton label="Cancel" onPress={onCancel} variant="subtle" fullWidth />
      </View>
    </ModalBackdropFrame>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '86%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
