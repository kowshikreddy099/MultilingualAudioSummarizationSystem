// YouTube URL patterns, supported languages, section metadata, pipeline stages

export const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w\-]{11}/;

export const SUPPORTED_LANGUAGES = [
  { value: "english", label: "🇬🇧 English" },
  { value: "hindi", label: "🇮🇳 Hindi" },
  { value: "spanish", label: "🇪🇸 Spanish" },
  { value: "french", label: "🇫🇷 French" },
  { value: "german", label: "🇩🇪 German" },
  { value: "chinese", label: "🇨🇳 Chinese" },
  { value: "japanese", label: "🇯🇵 Japanese" },
  { value: "arabic", label: "🇸🇦 Arabic" },
  { value: "portuguese", label: "🇧🇷 Portuguese" },
  { value: "korean", label: "🇰🇷 Korean" },
  { value: "telugu", label: "🇮🇳 Telugu" },
  { value: "tamil", label: "🇮🇳 Tamil" },
];

export const SECTION_META = {
  concise_summary: {
    icon: "📋",
    title: "Concise Summary",
    description: "Quick executive overview",
  },
  detailed_summary: {
    icon: "📖",
    title: "Detailed Summary",
    description: "Comprehensive breakdown",
  },
  topics: {
    icon: "🎯",
    title: "Topic Segments",
    description: "Key topics with timestamps",
  },
  speaker_insights: {
    icon: "🎤",
    title: "Speaker Insights",
    description: "Per-speaker analysis",
  },
  action_items: {
    icon: "✅",
    title: "Action Items",
    description: "Decisions and takeaways",
  },
  key_quotes: {
    icon: "💬",
    title: "Key Quotes",
    description: "Notable quotes with attribution",
  },
  translation: {
    icon: "🌍",
    title: "Translation",
    description: "Summary in your target language",
  },
  transcript: {
    icon: "📝",
    title: "Transcript",
    description: "Full transcription of the audio",
  },
};

export const SECTION_ORDER = [
  'transcript',
  "concise_summary",
  "detailed_summary",
  "topics",
  "speaker_insights",
  "action_items",
  "key_quotes",
  "translation",
];

export const PIPELINE_STAGES = [
  {
    id: "downloading",
    label: "Downloading Audio",
    description: "Extracting audio from YouTube…",
  },
  {
    id: "transcribing",
    label: "Transcribing",
    description: "Processing with Whisper Large V3…",
  },
  {
    id: "diarizing",
    label: "Identifying Speakers",
    description: "Running speaker diarization…",
  },
  {
    id: "summarizing",
    label: "Generating Summary",
    description: "Creating structured analysis with AI…",
  },
];

export const SPEAKER_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#14b8a6",
];
