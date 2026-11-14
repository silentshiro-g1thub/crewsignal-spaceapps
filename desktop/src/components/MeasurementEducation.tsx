import { desktopBridge } from '../bridge/desktopBridge';
import { useApp } from '../state/AppContext';
import { EVIDENCE_REGISTRY, MEASUREMENT_EDUCATION_SECTIONS, MEASUREMENT_RESEARCH, type MetricDefinition } from '../shared/src';

export function MeasurementEducation({ definition, collapsible = false }: {
  definition: MetricDefinition;
  collapsible?: boolean;
}) {
  const { showToast, openResearch } = useApp();
  const research = MEASUREMENT_RESEARCH[definition.id];
  const content = (
    <>
      <dl>
        {MEASUREMENT_EDUCATION_SECTIONS.map(({ field, label }) => {
          const { text, sourceId } = definition[field];
          const source = EVIDENCE_REGISTRY[sourceId]!;
          return (
            <div key={field}>
              <dt><strong>{label}</strong></dt>
              <dd style={{ margin: '0 0 0.75em' }}>
                {text}{' '}
                <a href={source.url} onClick={(event) => {
                  event.preventDefault();
                  void desktopBridge.openExternalUrl(source.url).catch(() => {
                    showToast({ tone: 'danger', title: 'Could not open source', detail: source.shortTitle });
                  });
                }}>{source.shortTitle}</a>
              </dd>
            </div>
          );
        })}
      </dl>
      <button type="button" className="btn-secondary" onClick={() => openResearch(research)}>
        View measurement research
      </button>
    </>
  );
  return collapsible ? <details><summary>About this measurement</summary>{content}</details> : content;
}
