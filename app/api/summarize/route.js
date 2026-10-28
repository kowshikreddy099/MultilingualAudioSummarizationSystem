/**
 * MLYTAS Pipeline Orchestrator — Vercel API Route
 * Receives an audio file, calls HF Space 1 (ASR) then HF Space 2 (Summarizer)
 * using the Gradio 5 Queue/SSE protocol, and streams results back to the client.
 */

export const maxDuration = 300; // 5 minutes max duration for Vercel
export const dynamic = 'force-dynamic';

const ASR_URL = process.env.HF_SPACE_ASR_URL;
const SUMMARIZER_URL = process.env.HF_SPACE_SUMMARIZER_URL;
const HF_TOKEN = process.env.HF_TOKEN;

function sseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Call a Gradio 5 Space's Queue-based API endpoint.
 * Joins the queue, streams events from the SSE endpoint, and returns the final completed data.
 */
async function callGradioQueue(baseUrl, apiName, dataArray, timeoutMs = 300_000) {
  const joinUrl = `${baseUrl}/gradio_api/call/${apiName}`;
  const headers = { 'Content-Type': 'application/json' };
  if (HF_TOKEN) {
    headers['Authorization'] = `Bearer ${HF_TOKEN}`;
  }

  const sessionHash = Math.random().toString(36).substring(2, 10);
  
  // 1. Join the queue
  const joinRes = await fetch(joinUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ data: dataArray, session_hash: sessionHash }),
  });

  if (!joinRes.ok) {
    const text = await joinRes.text().catch(() => '');
    throw new Error(`Failed to join queue: ${joinRes.status} ${text.slice(0, 200)}`);
  }

  const joinJson = await joinRes.json();
  const eventId = joinJson.event_id;
  if (!eventId) {
    throw new Error(`Queue did not return an event ID.`);
  }

  // 2. Stream results from the queue until complete
  const dataUrl = `${baseUrl}/gradio_api/call/${apiName}/${eventId}`;
  const dataHeaders = {};
  if (HF_TOKEN) {
    dataHeaders['Authorization'] = `Bearer ${HF_TOKEN}`;
  }

  const streamRes = await fetch(dataUrl, {
    headers: dataHeaders,
  });

  if (!streamRes.ok) {
    throw new Error(`Failed to establish event stream: ${streamRes.status}`);
  }

  if (!streamRes.body) {
    throw new Error('No stream body returned from Gradio event stream.');
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        const linesOfBlock = line.split('\n');
        let eventType = '';
        let dataStr = '';

        for (const l of linesOfBlock) {
          if (l.startsWith('event:')) {
            eventType = l.substring(6).trim();
          } else if (l.startsWith('data:')) {
            dataStr = l.substring(5).trim();
          }
        }

        if (eventType === 'complete') {
          clearTimeout(timer);
          const parsedData = JSON.parse(dataStr);
          return parsedData;
        } else if (eventType === 'error') {
          clearTimeout(timer);
          throw new Error(`Gradio queue error: ${dataStr}`);
        }
      }
    }
    clearTimeout(timer);
    throw new Error('Queue stream ended before completion.');
  } finally {
    reader.cancel();
  }
}

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return new Response(
      sseEvent('error', { message: 'Failed to parse form data.' }) + sseEvent('done', {}),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const file = formData.get('audio');
  const lang = formData.get('lang') ?? 'english';

  if (!file || typeof file === 'string') {
    return new Response(
      sseEvent('error', { message: 'No valid audio file provided.' }) + sseEvent('done', {}),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  if (!ASR_URL || !SUMMARIZER_URL) {
    return new Response(
      sseEvent('error', { message: 'Backend services are not configured.' }) + sseEvent('done', {}),
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(type, data) {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      }

      try {
        // ── Step 1: Upload to Gradio ──────────────────────────────────────
        send('stage', { stage: 'uploading' });

        const uploadData = new FormData();
        uploadData.append('files', file);

        const uploadHeaders = {};
        if (HF_TOKEN) {
          uploadHeaders['Authorization'] = `Bearer ${HF_TOKEN}`;
        }

        // Gradio 5 uploads live under /gradio_api/upload prefix
        const uploadRes = await fetch(`${ASR_URL}/gradio_api/upload`, {
          method: 'POST',
          body: uploadData,
          headers: uploadHeaders,
        });

        if (!uploadRes.ok) {
          throw new Error(`File upload failed with status ${uploadRes.status}`);
        }
        
        const uploadJson = await uploadRes.json();
        const uploadedFileMeta = uploadJson[0]; 
        
        // Prepare the FileData dictionary for the predict endpoint
        let uploadedPath = "";
        let origName = file.name || "audio.wav";
        if (typeof uploadedFileMeta === "string") {
            uploadedPath = uploadedFileMeta;
        } else if (uploadedFileMeta && typeof uploadedFileMeta === "object") {
            uploadedPath = uploadedFileMeta.path || uploadedFileMeta.name || "";
            origName = uploadedFileMeta.orig_name || origName;
        }

        const fileInput = {
          path: uploadedPath,
          orig_name: origName,
          meta: { _type: "gradio.FileData" }
        };

        // ── Step 2: ASR ──────────────────────────────────────────────────
        send('stage', { stage: 'transcribing' });

        let transcript;
        try {
          const raw = await callGradioQueue(ASR_URL, 'transcribe', [fileInput], 1_200_000);
          
          if (!raw || !Array.isArray(raw)) {
            throw new Error('Invalid response structure from ASR service.');
          }

          const transcriptText = raw[0];
          const metadata = raw[1] || {};

          if (!transcriptText) {
            throw new Error('No transcription returned from ASR service.');
          }

          transcript = {
            text: transcriptText,
            language: metadata.language || '',
            duration: metadata.duration || 0,
            segments: metadata.segments_list || []
          };
          // Emit the raw transcript to the client so the UI can show it
          try {
            send('section', { name: 'transcript', content: transcript });
          } catch (err) {
            // ignore send errors here; continue to summarization
          }
        } catch (err) {
          send('error', { message: `Transcription failed: ${err.message}` });
          send('done', {});
          controller.close();
          return;
        }

        send('stage', { stage: 'summarizing' });

        // ── Step 3: Summarization ────────────────────────────────────────
        let analysis;
        try {
          const transcriptStr = JSON.stringify(transcript);
          const raw = await callGradioQueue(SUMMARIZER_URL, 'summarize', [transcriptStr, lang], 180_000);
          
          let analysisRaw = raw?.[0];
          if (typeof analysisRaw === 'string') {
            analysis = JSON.parse(analysisRaw);
          } else {
            analysis = analysisRaw;
          }

          if (analysis?.error) throw new Error(analysis.error);
        } catch (err) {
          send('error', { message: `Summarization failed: ${err.message}` });
          send('done', {});
          controller.close();
          return;
        }

        // ── Stream sections one-by-one ───────────────────────────────────
        const SECTION_KEYS = [
          'concise_summary', 'detailed_summary', 'topics', 'speaker_insights',
          'action_items', 'key_quotes', 'translation',
        ];

        send('section', {
          name: '__meta__',
          content: {
            title: analysis.video_title ?? transcript?.video_title ?? file.name,
            duration_formatted: analysis.duration_formatted ?? '',
            language_detected: analysis.language_detected ?? transcript?.language ?? '',
          },
        });

        for (const key of SECTION_KEYS) {
          if (analysis[key] !== undefined) {
            send('section', { name: key, content: analysis[key] });
            await new Promise((r) => setTimeout(r, 120));
          }
        }

        send('done', {});
      } catch (err) {
        try {
          controller.enqueue(encoder.encode(sseEvent('error', { message: err.message ?? 'Unknown error' })));
          controller.enqueue(encoder.encode(sseEvent('done', {})));
        } catch {}
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
