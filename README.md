# MLYTAS — Multilingual Audio Summarization System

Upload an audio file to receive a Whisper transcript, structured summary, topic segments, action items, key quotes, and a translation. The default **On-device** mode is designed for recordings up to 75 seconds and does not require an API key, inference credits, or an audio upload to a third-party ASR service.

## Live Demo

**[Open the live application](https://multilingual-audio-summarization-sy-sigma.vercel.app)**

> On-device mode works without a Hugging Face token. Cloud mode is optional and requires a funded Hugging Face Inference Providers account.

## Features

- MP3, WAV, M4A, OGG, FLAC, AAC, and WebM upload (up to 25 MB)
- Browser-side Whisper Base transcription for short audio, cached after first use
- Optional cloud Whisper Large V3 transcription with timestamp data
- Concise and detailed summaries
- Topic segments, action items, and key quotes
- Translation into English, Hindi, Spanish, French, German, Chinese, Japanese, Arabic, Portuguese, Korean, Telugu, and Tamil
- Faithful speaker reporting: it does not invent speaker identities when they are not present in the transcript
- Streaming progress and useful error messages

## How it works

```text
Audio file
   ↓
On-device Whisper Base (default; audio stays in the browser)
   ↓
Faithful local transcript analysis
   ↓
Results in the browser

Optional cloud path:

```text
Audio file → Next.js API route → Hugging Face ASR → Hugging Face structured AI analysis
```
```

## Run locally

1. Install Node.js 18.17 or later and npm.
2. Install dependencies:

   ```powershell
   npm ci
   ```

3. Create `.env.local`:

   ```env
   HF_TOKEN=hf_your_token_here
   ```

4. Create the token in Hugging Face settings with **Inference Providers** permission. Keep it server-side; do not commit `.env.local`.
5. Start the project:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `HF_TOKEN` | Only for Cloud mode | Hugging Face token with Inference Providers permission and credits. |
| `HF_ASR_MODEL` | No | Override the default ASR model: `openai/whisper-large-v3-turbo`. |
| `HF_SUMMARIZER_MODEL` | No | Override the analysis model: `Qwen/Qwen3-32B:fastest`. |

## Accuracy and privacy

On-device mode downloads a public Whisper model from the Hugging Face Hub on first use and runs it in the browser. The selected audio stays on the device. Its extractive summary preserves sentences from the transcript and does not invent speakers, timestamps, action items, or quotes. Cloud mode sends audio from the app server to Hugging Face Inference Providers; do not upload recordings you are not permitted to process.

## Deployment

Deploy on Vercel with the Next.js preset. No environment variables are required for the on-device fallback. To enable Cloud mode, add `HF_TOKEN` in **Project Settings → Environment Variables**. The token must have Inference Providers permission and an active provider balance. Redeploy after changing environment variables.

The route has a five-minute execution limit, so short audio is best for the live demo.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start development mode |
| `npm run build` | Create a production build |
| `npm run start` | Start the production build |
| `npm run lint` | Run the configured linter |
