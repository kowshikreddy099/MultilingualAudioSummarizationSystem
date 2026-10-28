'use client';

import { useCallback, useState } from 'react';
import Header from '../components/Header';
import LoadingStages from '../components/LoadingStages';
import ResultsPanel from '../components/ResultsPanel';
import FileUploader from '../components/FileUploader';

const FEATURES = [
  { icon: '👥', label: 'Speaker Diarization' },
  { icon: '🎯', label: 'Topic Segmentation' },
  { icon: '✅', label: 'Action Items' },
  { icon: '🌍', label: 'Multilingual' },
  { icon: '⚡', label: 'Whisper V3' },
  { icon: '💬', label: 'Key Quotes' },
];

export default function HomePage() {
  const [file, setFile] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState('english');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [currentStage, setCurrentStage] = useState('uploading');
  const [sections, setSections] = useState({});
  const [videoMeta, setVideoMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const reset = useCallback(() => {
    setSections({});
    setVideoMeta(null);
    setErrorMessage('');
    setCurrentStage('uploading');
    setStatus('idle');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    reset();
    setStatus('loading');

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('lang', targetLanguage);

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        body: formData,
      });

      if (!res.body) {
        throw new Error('ReadableStream not supported by the browser.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? ''; // keep the last partial chunk

        for (const line of lines) {
          if (!line.trim()) continue;
          const [eventTypeStr, dataStr] = line.split('\ndata: ');
          if (!eventTypeStr || !dataStr) continue;

          const eventType = eventTypeStr.replace('event: ', '').trim();
          const data = JSON.parse(dataStr);

          if (eventType === 'stage') {
            setCurrentStage(data.stage);
          } else if (eventType === 'section') {
            if (data.name === '__meta__') {
              setVideoMeta(data.content);
            } else {
              setSections((prev) => ({ ...prev, [data.name]: data.content }));
            }
          } else if (eventType === 'error') {
            setErrorMessage(data.message ?? 'Something went wrong.');
            setStatus('error');
          } else if (eventType === 'done') {
            if (status !== 'error') setStatus('done');
          }
        }
      }
    } catch (err) {
      if (status !== 'done' && status !== 'error') {
        setErrorMessage('Failed to connect to the processing server. Please check your connection and try again.');
        setStatus('error');
      }
    }
  }, [file, targetLanguage, reset, status]);

  const isActive = status === 'loading' || status === 'done' || status === 'error';
  const hasResults = Object.keys(sections).length > 0;

  /* ── Idle / Hero view ─────────────────────────────────────────────────── */
  if (!isActive) {
    return (
      <main className="page-idle" id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__badge">
            <span className="hero__badge-dot" aria-hidden="true" />
            Powered by Whisper V3 · Groq · pyannote
          </div>
          <h1 className="hero__title" id="hero-title">
            Summarize Any<br />Audio File
          </h1>
          <p className="hero__subtitle">
            Upload an MP3 or WAV file and get instant speaker-attributed summaries,
            topic segments, action items, and multilingual translation.
          </p>
          <div className="hero__features" role="list" aria-label="Features">
            {FEATURES.map((f) => (
              <span key={f.label} className="feature-pill" role="listitem">
                <span className="feature-pill__icon" aria-hidden="true">{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>
        </section>

        <FileUploader
          file={file}
          setFile={setFile}
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
          onSubmit={handleSubmit}
          isLoading={false}
          compact={false}
        />
      </main>
    );
  }

  /* ── Active / Results view ─────────────────────────────────────────────── */
  return (
    <div className="page-active">
      <Header />

      {/* Compact search bar pinned below header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,6,26,0.6)', backdropFilter: 'blur(16px)' }}>
        <FileUploader
          file={file}
          setFile={setFile}
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
          onSubmit={() => { reset(); setTimeout(handleSubmit, 50); }}
          isLoading={status === 'loading'}
          compact
        />
      </div>

      {/* Error banner */}
      {status === 'error' && errorMessage && (
        <div className="error-banner" role="alert">
          <span className="error-banner__icon" aria-hidden="true">⚠️</span>
          <p className="error-banner__text">{errorMessage}</p>
        </div>
      )}

      {/* Loading stages */}
      {status === 'loading' && !hasResults && (
        <LoadingStages currentStage={currentStage} isVisible />
      )}

      {/* Stage indicator while loading but results are arriving */}
      {status === 'loading' && hasResults && (
        <div style={{ padding: '8px 28px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} />
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {currentStage === 'summarizing' ? 'Generating sections…' : 'Processing…'}
          </span>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <ResultsPanel
          sections={sections}
          streamingSection={null}
          streamingText=""
          videoMeta={videoMeta}
        />
      )}
    </div>
  );
}
