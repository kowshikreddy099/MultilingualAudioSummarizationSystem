'use client';

import { useState } from 'react';
import { SECTION_META, SPEAKER_COLORS } from '../lib/constants';

function formatSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function getSpeakerColor(speaker) {
  const idx = parseInt(speaker.replace(/\D/g, '') || '0', 10);
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

/* ── Content renderers ───────────────────────────────────────────────────── */

function TextContent({ text, isStreaming }) {
  return (
    <p className={`text-content${isStreaming ? ' streaming-cursor' : ''}`}>
      {text}
    </p>
  );
}

function TopicsContent({ data, isStreaming }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-content">{isStreaming ? '…' : 'No topics found.'}</p>;
  }
  return (
    <div className="topics-list">
      {data.map((topic, i) => (
        <div key={i} className="topic-item">
          <div className="topic-item__header">
            <span className="topic-item__title">{topic.title}</span>
            <span className="timestamp-badge">
              {formatSeconds(topic.start ?? 0)} – {formatSeconds(topic.end ?? 0)}
            </span>
          </div>
          <p className="topic-item__summary">{topic.summary}</p>
        </div>
      ))}
    </div>
  );
}

function SpeakerContent({ data, isStreaming }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-content">{isStreaming ? '…' : 'No speaker data.'}</p>;
  }
  return (
    <div className="speakers-list">
      {data.map((sp, i) => {
        const color = getSpeakerColor(sp.speaker ?? `${i}`);
        return (
          <div key={i} className="speaker-card">
            <div className="speaker-card__header">
              <span
                className="speaker-tag"
                style={{ color, borderColor: color, background: `${color}18` }}
              >
                🎤 {sp.speaker}
              </span>
            </div>
            <div className="speaker-card__meta">
              {sp.role_guess && (
                <span className="speaker-meta-badge">🏷️ {sp.role_guess}</span>
              )}
              {sp.speaking_time_seconds != null && (
                <span className="speaker-meta-badge">
                  ⏱ {formatSeconds(sp.speaking_time_seconds)} speaking
                </span>
              )}
            </div>
            {Array.isArray(sp.key_points) && sp.key_points.length > 0 && (
              <ul className="speaker-card__points">
                {sp.key_points.map((pt, j) => (
                  <li key={j}>{pt}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActionItemsContent({ data, isStreaming }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-content">{isStreaming ? '…' : 'No action items found.'}</p>;
  }
  return (
    <div className="action-list">
      {data.map((item, i) => (
        <div key={i} className="action-item">
          <span className="action-item__check" aria-hidden="true">✓</span>
          <span className="action-item__text">{item}</span>
        </div>
      ))}
    </div>
  );
}

function QuotesContent({ data, isStreaming }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-content">{isStreaming ? '…' : 'No quotes found.'}</p>;
  }
  return (
    <div className="quotes-list">
      {data.map((q, i) => {
        const color = getSpeakerColor(q.speaker ?? '0');
        return (
          <div key={i} className="quote-item">
            <p className="quote-item__text">{q.text}</p>
            <div className="quote-item__meta">
              <span className="quote-item__speaker" style={{ color }}>{q.speaker}</span>
              {q.timestamp != null && (
                <span className="quote-item__timestamp">@ {formatSeconds(q.timestamp)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TranslationContent({ data, isStreaming }) {
  if (!data) return <p className="text-content">{isStreaming ? '…' : 'No translation.'}</p>;
  return (
    <div className="translation-content">
      <span className="translation-lang">
        🌍 {data.target_language ?? 'Unknown language'}
      </span>
      <p className={`translation-text${isStreaming ? ' streaming-cursor' : ''}`}>
        {data.summary}
      </p>
    </div>
  );
}

/* ── Section Card ────────────────────────────────────────────────────────── */

function renderContent(name, content, isStreaming) {
  if (content === undefined || content === null) return null;

  switch (name) {
    case 'transcript':
      return (
        <TextContent
          text={typeof content === 'string' ? content : content.text ?? JSON.stringify(content, null, 2)}
          isStreaming={isStreaming}
        />
      );
    case 'topics':
      return <TopicsContent data={content} isStreaming={isStreaming} />;
    case 'speaker_insights':
      return <SpeakerContent data={content} isStreaming={isStreaming} />;
    case 'action_items':
      return <ActionItemsContent data={content} isStreaming={isStreaming} />;
    case 'key_quotes':
      return <QuotesContent data={content} isStreaming={isStreaming} />;
    case 'translation':
      return <TranslationContent data={content} isStreaming={isStreaming} />;
    default:
      return (
        <TextContent
          text={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
          isStreaming={isStreaming}
        />
      );
  }
}

function getClipboardText(name, content) {
  if (typeof content === 'string') return content;
  return JSON.stringify(content, null, 2);
}

export default function SectionCard({ name, content, isStreaming = false, delay = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta = SECTION_META[name] ?? { icon: '📄', title: name, description: '' };

  async function handleCopy(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getClipboardText(name, content));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  return (
    <article
      className="section-card"
      style={{ animationDelay: `${delay}ms` }}
      aria-label={meta.title}
    >
      <div
        className="section-card__header"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed((c) => !c)}
      >
        <div className="section-card__title-row">
          <span className="section-card__icon" aria-hidden="true">{meta.icon}</span>
          <span className="section-card__title">{meta.title}</span>
        </div>
        <div className="section-card__actions">
          {!isStreaming && (
            <button
              className={`copy-btn${copied ? ' copy-btn--copied' : ''}`}
              onClick={handleCopy}
              aria-label={`Copy ${meta.title}`}
              title="Copy to clipboard"
            >
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
          )}
          <button
            className={`collapse-btn${collapsed ? '' : ' collapse-btn--open'}`}
            aria-label={collapsed ? 'Expand section' : 'Collapse section'}
          >
            ▾
          </button>
        </div>
      </div>

      <div className={`section-card__body${collapsed ? ' section-card__body--hidden' : ''}`}>
        {renderContent(name, content, isStreaming)}
      </div>
    </article>
  );
}
