# MLYTAS — Multilingual Audio Summarization System

Upload an audio file to receive a Whisper transcript, structured summary, topic segments, action items, key quotes, and a translation. The application uses Hugging Face Inference Providers directly—no separately deployed Gradio Spaces are required.

## Live Demo

**[Open the live application](https://multilingual-audio-summarization-sy-sigma.vercel.app)**

> The app needs a valid Hugging Face token in Vercel before it can process audio.

## Features

- MP3, WAV, M4A, OGG, FLAC, AAC, and WebM upload (up to 25 MB)
- Whisper Large V3 transcription with timestamp data
- Concise and detailed summaries
- Topic segments, action items, and key quotes
- Translation into English, Hindi, Spanish, French, German, Chinese, Japanese, Arabic, Portuguese, Korean, Telugu, and Tamil
- Faithful speaker reporting: it does not invent speaker identities when they are not present in the transcript
- Streaming progress and useful error messages

## How it works

```text
Audio file
   ↓
Next.js API route (/api/summarize)
   ↓
Hugging Face Whisper ASR
   ↓
Hugging Face structured AI analysis
   ↓
Results in the browser
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
| `HF_TOKEN` | Yes | Hugging Face token with Inference Providers permission. |
| `HF_ASR_MODEL` | No | Override the default ASR model: `openai/whisper-large-v3-turbo`. |
| `HF_SUMMARIZER_MODEL` | No | Override the analysis model: `Qwen/Qwen3-32B:fastest`. |

## Accuracy and privacy

The app asks Whisper for timestamps, then asks the analysis model for a strict JSON response. Its prompt explicitly prohibits invented speakers, timestamps, action items, and quotes. The uploaded audio is sent only from the server to Hugging Face Inference Providers for processing; do not upload recordings you are not permitted to process.

## Deployment

Deploy on Vercel with the Next.js preset and add `HF_TOKEN` in **Project Settings → Environment Variables**. The token must have Inference Providers permission. Redeploy after changing environment variables.

The route has a five-minute execution limit, so short audio is best for the live demo.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start development mode |
| `npm run build` | Create a production build |
| `npm run start` | Start the production build |
| `npm run lint` | Run the configured linter |
