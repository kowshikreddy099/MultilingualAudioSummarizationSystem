# MLYTAS — Multilingual Audio Summarization System

Upload an audio file and receive a transcript plus structured, multilingual AI summaries. The application sends the audio to a Hugging Face transcription service, then sends the resulting transcript to a Hugging Face summarization service.

## Live Demo

**[Open the live application](https://multilingual-audio-summarization-sy-sigma.vercel.app)**

> The live demo is deployed on Vercel. GitHub Pages can display a static site, but it cannot run this project's server-side summarization route.

## Features

- Audio-file upload through the browser
- Transcription using a connected Hugging Face ASR service
- Speaker-aware transcript data when supplied by the ASR service
- Concise and detailed summaries
- Topic segments, action items, speaker insights, and key quotes
- Translation into English, Hindi, Spanish, French, German, Chinese, Japanese, Arabic, Portuguese, Korean, Telugu, and Tamil
- Streaming progress and results in the interface

## How It Works

```text
Audio file
   ↓
Next.js API route (/api/summarize)
   ↓
Hugging Face ASR Space (transcribe)
   ↓
Hugging Face summarizer Space (summarize)
   ↓
Structured results in the browser
```

The API route is implemented in `app/api/summarize/route.js`. It requires a server-capable host such as Vercel.

## Technology

- Next.js 14.2.15
- React 18.3.1
- React DOM 18.3.1
- Hugging Face Spaces using the Gradio queue API

## Run Locally

### Prerequisites

- Node.js 18.17.0 or later
- npm
- Access to the two required Hugging Face Spaces

### Installation

1. Clone or download the repository.

2. In the folder containing `package.json`, install dependencies:

   ```powershell
   npm ci
   ```

3. Create a `.env.local` file in the same folder:

   ```env
   HF_SPACE_ASR_URL=https://your-asr-space.hf.space
   HF_SPACE_SUMMARIZER_URL=https://your-summarizer-space.hf.space
   HF_TOKEN=hf_your_token_here
   ```

4. Replace the placeholder URLs with the actual Hugging Face Space URLs. Do not add a trailing slash.

5. Start the application:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `HF_SPACE_ASR_URL` | Yes | Base URL of the Hugging Face ASR Space. It must expose a `transcribe` API. |
| `HF_SPACE_SUMMARIZER_URL` | Yes | Base URL of the Hugging Face summarizer Space. It must expose a `summarize` API. |
| `HF_TOKEN` | Usually | Hugging Face bearer token used when either Space is private or protected. |

Keep `.env.local` private. Never commit it to GitHub or expose `HF_TOKEN` in browser-side variables.

## Deployment

The project is deployed at:

**[https://multilingual-audio-summarization-sy-sigma.vercel.app](https://multilingual-audio-summarization-sy-sigma.vercel.app)**

For a new Vercel deployment:

1. Import the GitHub repository into Vercel.
2. Set the Root Directory to the folder containing `package.json`.
3. Select the Next.js framework preset.
4. Add the environment variables in Vercel’s **Project Settings → Environment Variables**.
5. Deploy and test with a short audio file.

The summarization route has a five-minute execution limit, so long audio may time out. Test with a short MP3 or WAV file first.

## Project Structure

```text
app/
  api/summarize/route.js  # Upload, transcription, and summarization pipeline
  page.js                 # Main upload and results interface
components/               # User-interface components
lib/constants.js          # Languages, result sections, and UI metadata
next.config.mjs           # Next.js configuration
```

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server after building |
| `npm run lint` | Run the configured Next.js lint command |
