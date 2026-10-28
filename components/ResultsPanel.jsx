import { SECTION_ORDER } from '../lib/constants';
import SectionCard from './SectionCard';

export default function ResultsPanel({ sections, streamingSection, streamingText, videoMeta }) {
  const completedNames = SECTION_ORDER.filter(
    (name) => sections[name] !== undefined && name !== streamingSection
  );

  return (
    <div className="results-container" role="main">
      {/* Video metadata bar */}
      {videoMeta?.title && (
        <div className="results-meta" aria-label="Video information">
          <span className="results-meta__title" title={videoMeta.title}>
            🎬 {videoMeta.title}
          </span>
          {videoMeta.duration_formatted && (
            <span className="results-meta__badge">⏱ {videoMeta.duration_formatted}</span>
          )}
          {videoMeta.language_detected && (
            <span className="results-meta__badge">
              🌐 Detected: {videoMeta.language_detected.toUpperCase()}
            </span>
          )}
        </div>
      )}

      <div className="results-grid" aria-live="polite" aria-label="Analysis results">
        {/* Completed sections */}
        {completedNames.map((name, i) => (
          <SectionCard
            key={name}
            name={name}
            content={sections[name]}
            isStreaming={false}
            delay={i * 60}
          />
        ))}

        {/* Currently streaming section */}
        {streamingSection && (
          <SectionCard
            key={`streaming-${streamingSection}`}
            name={streamingSection}
            content={streamingText || '…'}
            isStreaming
            delay={0}
          />
        )}
      </div>
    </div>
  );
}
