'use client';

import { SUPPORTED_LANGUAGES } from '../lib/constants';
import { useRef } from 'react';

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  );
}

function Spinner() {
  return <span className="search-btn__spinner" aria-hidden="true" />;
}

export default function FileUploader({
  file,
  setFile,
  targetLanguage,
  setTargetLanguage,
  onSubmit,
  isLoading,
  compact = false,
}) {
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (file && !isLoading) onSubmit();
  }

  return (
    <div className={`search-container${compact ? ' search-container--compact' : ''}`}>
      <form onSubmit={handleSubmit} role="search" aria-label="Audio file upload">
        <div className={`search-input-wrapper${compact ? ' search-input-wrapper--compact' : ''}`} style={{ padding: compact ? '4px 8px' : '12px 16px', display: 'flex', alignItems: 'center' }}>
          
          <input
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isLoading}
          />
          
          <button 
            type="button"
            className="upload-trigger-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0',
              padding: compact ? '8px 12px' : '12px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
              textAlign: 'left'
            }}
          >
            <UploadIcon />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file ? file.name : "Select an audio file (MP3, WAV, etc.)"}
            </span>
          </button>

          <button
            id="summarize-btn"
            type="submit"
            className={`search-btn${compact ? ' search-btn--compact' : ''}`}
            disabled={!file || isLoading}
            aria-label={isLoading ? 'Summarizing…' : 'Summarize audio'}
            style={{ marginLeft: '12px' }}
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
