import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { MEASUREMENT_RESEARCH, EVIDENCE_REGISTRY, MEASUREMENT_EDUCATION_SECTIONS, type MetricDefinition } from '../shared/src';
import { ActionButton } from './AppPrimitives';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';

export function MeasurementEducation({ definition, collapsible = false }: {
  definition: MetricDefinition;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { palette } = useCrewTheme();
  const { io, announce, openResearch } = useCrewSignal();

  return (
    <View style={{ gap: 8 }}>
      {collapsible && (
        <Text
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={{ color: palette.textPrimary, paddingVertical: 12, fontWeight: '600' }}
        >
          About this measurement
        </Text>
      )}
      {(!collapsible || expanded) && MEASUREMENT_EDUCATION_SECTIONS.map(({ field, label }) => {
        const { text, sourceId } = definition[field];
        const source = EVIDENCE_REGISTRY[sourceId]!;
        return (
          <View key={field}>
            <Text accessibilityRole="header" style={{ color: palette.textPrimary, fontWeight: '600' }}>{label}</Text>
            <Text style={{ color: palette.textBody }}>{text}</Text>
            <Text accessibilityRole="link" onPress={async () => {
              const result = await io.openExternalUrl(source.url);
              if (!result.ok) announce(result.message);
            }} style={{ color: palette.textPrimary, textDecorationLine: 'underline', paddingVertical: 12 }}>
              {source.shortTitle}
            </Text>
          </View>
        );
      })}
      {(!collapsible || expanded) && (
        <ActionButton label="View measurement research" variant="secondary"
          onPress={() => openResearch(MEASUREMENT_RESEARCH[definition.id])} />
      )}
    </View>
  );
}
