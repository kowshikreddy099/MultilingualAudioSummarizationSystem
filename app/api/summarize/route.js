/**
 * Audio-analysis pipeline.
 *
 * The route keeps Hugging Face credentials server-side, uploads the audio to
 * the configured ASR Space, then sends the normalized transcript to the
 * configured summarizer Space.
 */

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const ASR_URL = process.env.HF_SPACE_ASR_URL?.trim();
const SUMMARIZER_URL = process.env.HF_SPACE_SUMMARIZER_URL?.trim();
const HF_TOKEN = process.env.HF_TOKEN?.trim();
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const AUDIO_FILE_EXTENSIONS = /\.(aac|flac|m4a|mp3|ogg|opus|wav|webm)$/i;

function sseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamError(message, status = 500) {
  return new Response(
    sseEvent('error', { message }) + sseEvent('done', {}),
    {
      status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }
  );
}

function normalizeBaseUrl(value) {
  return value?.replace(/\/+$/, '');
}

function isRealServiceUrl(value) {
  if (!value || /your-|placeholder|example/i.test(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function getConfigurationError() {
  const missing = [];
  if (!isRealServiceUrl(ASR_URL)) missing.push('HF_SPACE_ASR_URL');
  if (!isRealServiceUrl(SUMMARIZER_URL)) missing.push('HF_SPACE_SUMMARIZER_URL');

  if (missing.length === 0) return null;

  return `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not configured with real Hugging Face Space URLs. Add the actual service URLs in Vercel Environment Variables, then redeploy.`;
}

function authorizationHeaders() {
  return HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {};
}

function readableUpstreamError(prefix, status, body = '') {
  const detail = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
  return detail ? `${prefix} (${status}): ${detail}` : `${prefix} (${status}).`;
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function parsePossiblyJson(value) {
  let parsed = value;
  for (let attempt = 0; attempt < 2 && typeof parsed === 'string'; attempt += 1) {
    const trimmed = parsed.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) break;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      break;
    }
  }
  return parsed;
}

function parseSseBlock(block) {
  let event = 'message';
  const data = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }

  return { event, data: data.join('\n') };
}

/**
 * Calls a Gradio queue endpoint using the Gradio 4/5 SSE flow. The timeout
 * aborts both the queue join and event stream; the old implementation created
 * an AbortController but never attached it to either fetch request.
 */
async function callGradioQueue(baseUrl, apiName, dataArray, timeoutMs) {
  const base = normalizeBaseUrl(baseUrl);
  const endpoint = String(apiName).replace(/^\/+/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let reader;

  try {
    const joinRes = await fetch(`${base}/gradio_api/call/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authorizationHeaders() },
      body: JSON.stringify({
        data: dataArray,
        session_hash: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      }),
      signal: controller.signal,
    });

    if (!joinRes.ok) {
      throw new Error(readableUpstreamError(
        'Unable to join the processing queue',
        joinRes.status,
        await joinRes.text().catch(() => '')
      ));
    }

    const joined = await joinRes.json().catch(() => {
      throw new Error('The processing service returned an invalid queue response.');
    });
    const eventId = joined?.event_id ?? joined?.eventId;

    // Some non-queued Gradio deployments return data immediately.
    if (!eventId && joined?.data !== undefined) return joined.data;
    if (!eventId) throw new Error('The processing service did not return a queue event ID.');

    const streamRes = await fetch(`${base}/gradio_api/call/${endpoint}/${eventId}`, {
      headers: { Accept: 'text/event-stream', ...authorizationHeaders() },
      signal: controller.signal,
    });

    if (!streamRes.ok) {
      throw new Error(readableUpstreamError(
        'Unable to read the processing queue',
        streamRes.status,
        await streamRes.text().catch(() => '')
      ));
    }
    if (!streamRes.body) throw new Error('The processing service returned no event stream.');

    reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const { event, data } = parseSseBlock(block);

        if (event === 'complete') return parseJson(data, 'The processing service');
        if (event === 'error') {
          const details = parsePossiblyJson(data);
          throw new Error(typeof details === 'string' ? details : JSON.stringify(details));
        }
      }
    }

    throw new Error('The processing queue closed before it returned a result.');
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`The processing service did not finish within ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await reader?.cancel().catch(() => {});
  }
}

function getUploadedFileMeta(uploadResponse, originalName) {
  const response = parsePossiblyJson(uploadResponse);
  const files = Array.isArray(response)
    ? response
    : response?.files ?? response?.data ?? [];
  const item = Array.isArray(files) ? files[0] : files;

  const path = typeof item === 'string'
    ? item
    : item?.path ?? item?.name ?? item?.url;

  if (!path) throw new Error('The transcription service did not return an uploaded file path.');

  return {
    path,
    orig_name: item?.orig_name ?? originalName,
    meta: { _type: 'gradio.FileData' },
  };
}

function normalizeTranscript(raw) {
  const result = parsePossiblyJson(raw);
  const first = Array.isArray(result) ? parsePossiblyJson(result[0]) : result;
  const metadataValue = Array.isArray(result) ? result[1] : first?.metadata;
  const metadata = parsePossiblyJson(metadataValue) ?? {};
  const text = typeof first === 'string'
    ? first.trim()
    : (first?.text ?? first?.transcript ?? first?.transcription ?? '').trim();

  if (!text) throw new Error('The transcription service returned no transcript text.');

  return {
    text,
    language: metadata?.language ?? first?.language ?? '',
    duration: metadata?.duration ?? first?.duration ?? 0,
    segments: metadata?.segments_list ?? metadata?.segments ?? first?.segments ?? [],
  };
}

function normalizeAnalysis(raw) {
  const result = parsePossiblyJson(raw);
  const first = Array.isArray(result) ? result[0] : result;
  const analysis = parsePossiblyJson(first);

  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    throw new Error('The summarization service returned an invalid analysis result.');
  }
  if (analysis.error) throw new Error(String(analysis.error));

  const expectedSections = [
    'concise_summary', 'detailed_summary', 'topics', 'speaker_insights',
    'action_items', 'key_quotes', 'translation',
  ];
  if (!expectedSections.some((key) => analysis[key] !== undefined)) {
    throw new Error('The summarization service returned no analysis sections.');
  }

  return analysis;
}

export async function POST(request) {
  const configurationError = getConfigurationError();
  if (configurationError) return streamError(configurationError, 503);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return streamError('The uploaded form data could not be read.', 400);
  }

  const file = formData.get('audio');
  const lang = String(formData.get('lang') ?? 'english').toLowerCase();

  if (!file || typeof file === 'string') {
    return streamError('Choose an audio file before starting the analysis.', 400);
  }
  if (!file.size) return streamError('The selected audio file is empty.', 400);
  if (file.size > MAX_AUDIO_BYTES) {
    return streamError('This demo accepts audio files up to 25 MB. Please trim or compress the recording and try again.', 413);
  }
  if (!file.type.startsWith('audio/') && !AUDIO_FILE_EXTENSIONS.test(file.name)) {
    return streamError('Please upload a supported audio file such as MP3, WAV, M4A, OGG, or WebM.', 415);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type, data) => controller.enqueue(encoder.encode(sseEvent(type, data)));

      try {
        send('stage', { stage: 'uploading' });

        const uploadData = new FormData();
        uploadData.append('files', file, file.name || 'audio.wav');
        const uploadRes = await fetch(`${normalizeBaseUrl(ASR_URL)}/gradio_api/upload`, {
          method: 'POST',
          body: uploadData,
          headers: authorizationHeaders(),
        });

        if (!uploadRes.ok) {
          throw new Error(readableUpstreamError(
            'Audio upload failed',
            uploadRes.status,
            await uploadRes.text().catch(() => '')
          ));
        }

        const uploadResponse = await uploadRes.json().catch(() => {
          throw new Error('The transcription service returned an invalid upload response.');
        });
        const fileInput = getUploadedFileMeta(uploadResponse, file.name || 'audio.wav');

        send('stage', { stage: 'transcribing' });
        const transcript = normalizeTranscript(
          await callGradioQueue(ASR_URL, 'transcribe', [fileInput], 1_200_000)
        );
        send('section', { name: 'transcript', content: transcript });

        send('stage', { stage: 'summarizing' });
        const analysis = normalizeAnalysis(
          await callGradioQueue(
            SUMMARIZER_URL,
            'summarize',
            [JSON.stringify(transcript), lang],
            180_000
          )
        );

        send('section', {
          name: '__meta__',
          content: {
            title: analysis.video_title ?? analysis.title ?? file.name,
            duration_formatted: analysis.duration_formatted ?? '',
            language_detected: analysis.language_detected ?? transcript.language ?? '',
          },
        });

        for (const key of [
          'concise_summary', 'detailed_summary', 'topics', 'speaker_insights',
          'action_items', 'key_quotes', 'translation',
        ]) {
          if (analysis[key] !== undefined) send('section', { name: key, content: analysis[key] });
        }

        send('done', {});
      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Audio analysis failed.' });
        send('done', {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
