import type { BodySystemId, MetricId } from './contracts';

export const MISSION_RESEARCH_SOURCE_IDS = [
  'nasa-hrp-hazards',
  'nasa-hrp-risks',
  'nasa-ongoing-hrp-research',
  'csa-radiation-monitoring',
  'csa-iss-experiments',
] as const;

type MissionResearchSourceId = typeof MISSION_RESEARCH_SOURCE_IDS[number];

export interface ResearchContext {
  sourceId: MissionResearchSourceId;
  text: string;
}

export const BODY_SYSTEM_RESEARCH: Record<BodySystemId, ResearchContext> = {
  sleep_cognition: {
    sourceId: 'nasa-ongoing-hrp-research',
    text: 'Isolation, disrupted sleep and changing schedules can affect crew performance. ARCHeR pairs wearable data with crew feedback. Sleep periods and mood check-ins provide self-reported context.',
  },
  cardiovascular: {
    sourceId: 'nasa-hrp-risks',
    text: 'The cardiovascular system adapts to altered gravity. Record the device and method, posture and rest before heart rate or blood pressure readings so you can compare readings taken under similar conditions.',
  },
  musculoskeletal: {
    sourceId: 'csa-iss-experiments',
    text: 'Researchers study how weightlessness affects muscles and bones. CrewSignal check-ins leave muscle strength and bone health unassessed.',
  },
  immune_context: {
    sourceId: 'nasa-hrp-risks',
    text: 'NASA studies immune changes during spaceflight. CrewSignal check-ins leave immune function unassessed.',
  },
  nutrition_metabolism: {
    sourceId: 'nasa-hrp-hazards',
    text: 'Food, schedules and the closed spacecraft environment can affect a crew member’s routine. A glucose or temperature entry records a measurement with its context. Nutritional status remains unassessed.',
  },
};

export const MEASUREMENT_RESEARCH: Record<MetricId, ResearchContext> = {
  sleep: BODY_SYSTEM_RESEARCH.sleep_cognition,
  mood: BODY_SYSTEM_RESEARCH.sleep_cognition,
  heart_rate: BODY_SYSTEM_RESEARCH.cardiovascular,
  blood_pressure: BODY_SYSTEM_RESEARCH.cardiovascular,
  blood_glucose: BODY_SYSTEM_RESEARCH.nutrition_metabolism,
  body_temperature: BODY_SYSTEM_RESEARCH.nutrition_metabolism,
};

export const RADIATION_RESEARCH: ResearchContext = {
  sourceId: 'csa-radiation-monitoring',
  text: 'CSA’s Canadian Active Neutron Spectrometer (CANS) is a dedicated instrument designed to measure neutron exposure. CrewSignal check-ins leave radiation exposure unassessed.',
};
