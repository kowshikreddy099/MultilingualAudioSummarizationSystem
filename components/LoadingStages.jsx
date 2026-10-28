import { PIPELINE_STAGES } from '../lib/constants';

const STAGE_ICONS = {
  downloading: '⬇️',
  transcribing: '🎙️',
  diarizing: '👥',
  summarizing: '✨',
};

function getStageState(stageId, currentStage) {
  const stageIds = PIPELINE_STAGES.map((s) => s.id);
  const currentIdx = stageIds.indexOf(currentStage);
  const thisIdx = stageIds.indexOf(stageId);
  if (currentIdx === -1 || thisIdx < currentIdx) return 'completed';
  if (thisIdx === currentIdx) return 'active';
  return 'pending';
}

export default function LoadingStages({ currentStage, isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="loading-wrapper" role="status" aria-label="Processing pipeline status">
      <div className="loading-stages">
        {PIPELINE_STAGES.map((stage) => {
          const state = getStageState(stage.id, currentStage);
          return (
            <div
              key={stage.id}
              className={`loading-stage loading-stage--${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <div className="loading-stage__icon" aria-hidden="true">
                {state === 'completed' ? '✓' : STAGE_ICONS[stage.id]}
              </div>
              <div className="loading-stage__info">
                <div className="loading-stage__label">{stage.label}</div>
                {state === 'active' && (
                  <div className="loading-stage__desc">{stage.description}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
