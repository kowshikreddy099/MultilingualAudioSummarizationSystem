'use client';

import { useCallback, useState } from 'react';
import Header from '../components/Header';
import LoadingStages from '../components/LoadingStages';
import ResultsPanel from '../components/ResultsPanel';
import FileUploader from '../components/FileUploader';
import { analyzeOnDevice } from '../lib/onDeviceAnalysis';

const FEATURES = [
  { icon: '💻', label: 'On-device mode' },
  { icon: '🎯', label: 'Topic Segmentation' },
  { icon: '✅', label: 'Action Items' },
  { icon: '🌍', label: 'Multilingual' },
  { icon: '🔒', label: 'Private audio option' },
  { icon: '💬', label: 'Key Quotes' },
];

function parseSseBlock(block) {
  let event = 'message';
  const dataLines = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }

  if (!dataLines.length) return null;
  return { event, data: JSON.parse(dataLines.join('\n')) };
}

function responseErrorMessage(body, status) {
  const dataLine = body.split(/\r?\n/).find((line) => line.startsWith('data:'));
  if (dataLine) {
    try {
      const data = JSON.parse(dataLine.slice(5).trim());
      if (data?.message) return data.message;
    } catch {}
  }

  return `The processing server responded with status ${status}. Please try again.`;
}

export default function HomePage() {
  const [file, setFile] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState('english');
  const [processingMode, setProcessingMode] = useState('on-device');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [currentStage, setCurrentStage] = useState('uploading');
  const [sections, setSections] = useState({});
  const [videoMeta, setVideoMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const reset = useCallback(() => {
    setSections({});
    setVideoMeta(null);
    setErrorMessage('');
    setNoticeMessage('');
    setCurrentStage('uploading');
    setStatus('idle');
  }, []);

  const runOnDeviceAnalysis = useCallback(async (fallback = false) => {
    if (!file) return;

    setSections({});
    setVideoMeta(null);
    setCurrentStage('downloading');
    setNoticeMessage(
      fallback
        ? 'Cloud inference is unavailable, so this short recording is being processed privately on this device.'
        : 'On-device mode downloads an open Whisper model once, then keeps the selected audio on this device.'
    );

    // Let React draw the loading stage before model loading starts on the main thread.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const result = await analyzeOnDevice({
      file,
      targetLanguage,
      onStage: setCurrentStage,
      onProgress: setNoticeMessage,
    });

    setVideoMeta(result.meta);
    setSections({
      transcript: result.transcript,
      concise_summary: result.analysis.concise_summary,
      detailed_summary: result.analysis.detailed_summary,
      topics: result.analysis.topics,
      action_items: result.analysis.action_items,
      key_quotes: result.analysis.key_quotes,
      translation: result.analysis.translation,
    });
    setNoticeMessage('Analyzed on this device. The selected audio was not sent to a transcription service.');
    setStatus('done');
  }, [file, targetLanguage]);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    reset();
    setStatus('loading');
    setCurrentStage('uploading');

    if (processingMode === 'on-device') {
      try {
        await runOnDeviceAnalysis();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'On-device audio analysis failed.');
        setStatus('error');
      }
      return;
    }

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('lang', targetLanguage);

    let receivedError = false;

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(responseErrorMessage(await res.text(), res.status));
      }
      if (!res.body) {
        throw new Error('ReadableStream not supported by the browser.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          const message = parseSseBlock(block);
          if (!message) continue;

          const { event: eventType, data } = message;

          if (eventType === 'stage') {
            setCurrentStage(data.stage);
          } else if (eventType === 'section') {
            if (data.name === '__meta__') {
              setVideoMeta(data.content);
            } else {
              setSections((prev) => ({ ...prev, [data.name]: data.content }));
            }
          } else if (eventType === 'error') {
            const message = data.message ?? 'Something went wrong.';
            if (/no remaining credits|inference providers|\(402\)/i.test(message)) {
              await reader.cancel();
              await runOnDeviceAnalysis(true);
              return;
            }
            receivedError = true;
            setErrorMessage(message);
            setStatus('error');
            await reader.cancel();
            return;
          } else if (eventType === 'done') {
            completed = true;
          }
        }
      }

      if (!completed) {
        throw new Error('Processing stopped before the analysis was completed. Please try again.');
      }
      setStatus('done');
    } catch (err) {
      if (!receivedError) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to the processing server.');
        setStatus('error');
      }
    }
  }, [file, targetLanguage, processingMode, reset, runOnDeviceAnalysis]);

  const isActive = status === 'loading' || status === 'done' || status === 'error';
  const hasResults = Object.keys(sections).length > 0;

  /* ── Idle / Hero view ─────────────────────────────────────────────────── */
  if (!isActive) {
    return (
      <main className="page-idle" id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__badge">
            <span className="hero__badge-dot" aria-hidden="true" />
            On-device Whisper · Cloud analysis optional
          </div>
          <h1 className="hero__title" id="hero-title">
            Summarize Any<br />Audio File
          </h1>
          <p className="hero__subtitle">
            Analyze short MP3 or WAV recordings directly in your browser—no credits needed.
            Cloud mode remains available for enhanced analysis when a provider is enabled.
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
          processingMode={processingMode}
          setProcessingMode={setProcessingMode}
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
          processingMode={processingMode}
          setProcessingMode={setProcessingMode}
          onSubmit={handleSubmit}
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

      {noticeMessage && status !== 'error' && (
        <div className="info-banner" role="status">
          <span aria-hidden="true">ℹ️</span>
          <p>{noticeMessage}</p>
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
