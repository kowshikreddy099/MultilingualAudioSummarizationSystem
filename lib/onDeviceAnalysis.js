const LOCAL_MODEL = 'Xenova/whisper-base';
const MAX_ON_DEVICE_SECONDS = 75;

let transcriberPromise;

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function words(value) {
  return cleanText(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function formatLanguage(value) {
  return String(value || 'Auto-detected').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function splitSentences(text) {
  const normalized = cleanText(text);
  if (!normalized) return [];

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(normalized)]
      .map((part) => cleanText(part.segment))
      .filter(Boolean);
  }

  return normalized.split(/(?<=[.!?।])\s+/u).map(cleanText).filter(Boolean);
}

function sentenceScore(sentence, frequency) {
  const tokens = words(sentence);
  if (!tokens.length) return 0;
  const frequencyScore = tokens.reduce((total, token) => total + (frequency.get(token) ?? 0), 0);
  const idealLengthBonus = tokens.length >= 6 && tokens.length <= 42 ? 1 : 0;
  return frequencyScore / Math.sqrt(tokens.length) + idealLengthBonus;
}

function pickImportantSentences(sentences, limit) {
  const frequency = new Map();
  for (const sentence of sentences) {
    for (const token of words(sentence)) {
      if (token.length > 2) frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, frequency) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(limit, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map(({ sentence }) => sentence);

  return ranked;
}

function chunkTimestamp(chunk, fallbackStart, fallbackEnd) {
  const value = chunk?.timestamp ?? chunk?.timestamps;
  const [start, end] = Array.isArray(value) ? value : [fallbackStart, fallbackEnd];
  return {
    start: Number.isFinite(start) ? start : fallbackStart,
    end: Number.isFinite(end) ? end : fallbackEnd,
  };
}

function hasReliableTimestamps(chunks, duration) {
  return chunks.some((chunk) => {
    const [start, end] = Array.isArray(chunk?.timestamp) ? chunk.timestamp : [];
    return (Number.isFinite(start) && start > 0)
      || (Number.isFinite(end) && end > 0 && end < duration);
  });
}

function makeTopics(chunks, transcript, duration, timestampsReliable) {
  const source = chunks.length
    ? chunks
    : [{ text: transcript, timestamp: [0, duration] }];
  const topicCount = Math.max(1, Math.min(4, Math.ceil(source.length / 2)));
  const size = Math.ceil(source.length / topicCount);

  return Array.from({ length: topicCount }, (_, index) => source.slice(index * size, (index + 1) * size))
    .filter((group) => group.length > 0)
    .map((group, index) => {
      const combined = cleanText(group.map((chunk) => chunk.text).join(' '));
      const first = chunkTimestamp(group[0], 0, 0);
      const last = chunkTimestamp(group[group.length - 1], first.start, duration);
      const titleWords = words(combined).slice(0, 7).join(' ');
      const approximateStart = (duration * index) / topicCount;
      const approximateEnd = (duration * (index + 1)) / topicCount;
      return {
        title: titleWords ? titleWords.replace(/^./, (letter) => letter.toUpperCase()) : `Topic ${index + 1}`,
        summary: combined || `Audio segment ${index + 1}`,
        start: timestampsReliable ? first.start : approximateStart,
        end: timestampsReliable ? Math.max(first.end, last.end) : approximateEnd,
        timing_estimated: !timestampsReliable,
      };
    });
}

function makeQuotes(chunks, important, timestampsReliable) {
  const candidates = important.length ? important : chunks.map((chunk) => cleanText(chunk.text)).filter(Boolean);
  return candidates.slice(0, 2).map((text) => {
    const quoteWords = words(text);
    const firstMeaningfulWord = quoteWords.find((word) => word.length > 2);
    const matchingChunk = chunks.find((chunk) => {
      const chunkText = cleanText(chunk.text);
      return chunkText.includes(text)
        || text.includes(chunkText)
        || (firstMeaningfulWord && words(chunkText).includes(firstMeaningfulWord));
    });
    return {
      text,
      speaker: 'Speaker not identified',
      timestamp: timestampsReliable ? chunkTimestamp(matchingChunk, 0, 0).start : undefined,
    };
  });
}

function makeActionItems(sentences) {
  // Keep this deliberately conservative. A mention of "review" or "send"
  // alone is not an action item unless the sentence explicitly directs it.
  const actionLanguage = /\b(action item|todo|to do|need to|needs to|should|we(?:'ll| will)|i(?:'ll| will)|let's|please|follow up|send\s+(?:the|a|an|my|your)|prepare\s+(?:the|a|an)|review\s+(?:the|this|a|an)|assign\s+(?:the|a|an)|deadline)\b/i;
  return sentences.filter((sentence) => actionLanguage.test(sentence)).slice(0, 5);
}

function buildFaithfulAnalysis({ text, chunks, duration, targetLanguage }) {
  const sentences = splitSentences(text);
  const important = pickImportantSentences(sentences, 3);
  const concise = important.join(' ') || text;
  const detailed = pickImportantSentences(sentences, 6).join(' ') || text;
  const requiresCloudTranslation = targetLanguage !== 'english';
  const timestampsReliable = hasReliableTimestamps(chunks, duration);

  return {
    concise_summary: concise,
    detailed_summary: detailed,
    topics: makeTopics(chunks, text, duration, timestampsReliable),
    action_items: makeActionItems(sentences),
    key_quotes: makeQuotes(chunks, important, timestampsReliable),
    translation: {
      target_language: requiresCloudTranslation
        ? `${formatLanguage(targetLanguage)} (cloud translation required)`
        : 'English',
      summary: requiresCloudTranslation
        ? 'On-device mode keeps the faithful summary in the source language. Choose Cloud mode after enabling an inference provider to translate it.'
        : concise,
    },
  };
}

async function decodeAudioFile(file) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor || !window.OfflineAudioContext) {
    throw new Error('This browser cannot decode audio for on-device transcription. Try a current version of Chrome, Edge, or Firefox.');
  }

  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      throw new Error('The selected audio could not be decoded. Try MP3, WAV, M4A, or WebM.');
    }
    if (decoded.duration > MAX_ON_DEVICE_SECONDS) {
      throw new Error(`On-device mode supports recordings up to ${MAX_ON_DEVICE_SECONDS} seconds. Trim the audio or choose Cloud mode.`);
    }

    const sampleRate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { samples: rendered.getChannelData(0), duration: decoded.duration };
  } finally {
    await context.close?.();
  }
}

async function getTranscriber(onProgress) {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      return pipeline('automatic-speech-recognition', LOCAL_MODEL, {
        progress_callback: (progress) => {
          if (progress?.status === 'progress') {
            onProgress?.(`Downloading the on-device Whisper model: ${Math.round(progress.progress ?? 0)}%`);
          }
        },
      });
    })();
  }

  try {
    return await transcriberPromise;
  } catch (error) {
    transcriberPromise = undefined;
    throw error;
  }
}

/**
 * Runs ASR in the browser. The file itself stays on the device; only the
 * public model files are downloaded and cached by the browser on first use.
 */
export async function analyzeOnDevice({ file, targetLanguage, onStage, onProgress }) {
  onStage?.('downloading');
  onProgress?.('Preparing the on-device Whisper model…');
  const [audio, transcriber] = await Promise.all([decodeAudioFile(file), getTranscriber(onProgress)]);

  onStage?.('transcribing');
  onProgress?.('Transcribing on this device…');
  const result = await transcriber(audio.samples, {
    // Use word-level timings when the browser runtime can provide them.
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
    task: 'transcribe',
  });

  const text = cleanText(result?.text);
  if (!text) throw new Error('On-device Whisper returned an empty transcript. Try clearer audio or Cloud mode.');

  const chunks = Array.isArray(result?.chunks)
    ? result.chunks.map((chunk) => ({
      text: cleanText(chunk.text),
      timestamp: chunkTimestamp(chunk, 0, audio.duration),
    })).filter((chunk) => chunk.text)
    : [];

  onStage?.('summarizing');
  onProgress?.('Building a faithful summary from the local transcript…');
  const analysis = buildFaithfulAnalysis({ text, chunks, duration: audio.duration, targetLanguage });

  return {
    transcript: { text, chunks },
    analysis,
    meta: {
      title: file.name,
      duration_formatted: new Date(Math.round(audio.duration) * 1000).toISOString().slice(14, 19),
      language_detected: result?.language || 'on-device auto-detection',
    },
  };
}
