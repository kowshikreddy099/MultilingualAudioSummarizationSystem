'use client';

import { SUPPORTED_LANGUAGES, YOUTUBE_URL_REGEX } from '../lib/constants';

function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function Spinner() {
  return <span className="search-btn__spinner" aria-hidden="true" />;
}

export default function SearchBar({
  url,
  setUrl,
  targetLanguage,
  setTargetLanguage,
  onSubmit,
  isLoading,
  compact = false,
}) {
  const isValid = YOUTUBE_URL_REGEX.test(url.trim());
  const hasInput = url.trim().length > 0;

  function handleKeyDown(e) {
    if (e.key === 'Enter' && isValid && !isLoading) {
      onSubmit();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (isValid && !isLoading) onSubmit();
  }

  return (
    <div className={`search-container${compact ? ' search-container--compact' : ''}`}>
      <form onSubmit={handleSubmit} role="search" aria-label="YouTube URL input">
        <div className={`search-input-wrapper${compact ? ' search-input-wrapper--compact' : ''}`}>
          <span className="search-icon">
            <YouTubeIcon />
          </span>

          <input
            id="youtube-url-input"
            type="url"
            className={`search-input${compact ? ' search-input--compact' : ''}`}
            placeholder="Paste a YouTube link to summarize…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoComplete="off"
            autoFocus={!compact}
            aria-label="YouTube video URL"
            aria-describedby={hasInput && !isValid ? 'url-error' : undefined}
          />

          {hasInput && (
            <span
              className="search-validation"
              title={isValid ? 'Valid YouTube URL' : 'Invalid YouTube URL'}
              aria-live="polite"
            >
              {isValid ? '✅' : '⚠️'}
            </span>
          )}

          <button
            id="summarize-btn"
            type="submit"
            className={`search-btn${compact ? ' search-btn--compact' : ''}`}
            disabled={!isValid || isLoading}
            aria-label={isLoading ? 'Summarizing…' : 'Summarize video'}
          >
            {isLoading ? (
              <>
                <Spinner />
                {!compact && 'Processing…'}
              </>
            ) : (
              <>
                {!compact && '✨ '}
                Summarize
              </>
            )}
          </button>
        </div>

        {hasInput && !isValid && (
          <p id="url-error" style={{ fontSize: '12px', color: '#fca5a5', marginTop: '8px', paddingLeft: '4px' }}>
            Please enter a valid YouTube URL (youtube.com/watch, youtu.be, or youtube.com/shorts)
          </p>
        )}
      </form>

      {!compact && (
        <div className="language-row">
          <label htmlFor="language-select" className="language-label">
            Translate summary to:
          </label>
          <select
            id="language-select"
            className="language-select"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={isLoading}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
