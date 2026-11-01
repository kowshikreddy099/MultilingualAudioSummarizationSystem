import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'MLYTAS | Multilingual Audio Summarizer',
  description:
    'Transcribe and summarize audio files with topic segments, action items, and multilingual translation powered by Whisper and AI.',
  keywords: [
    'audio transcription',
    'multilingual',
    'AI summarization',
    'Whisper',
    'podcast summary',
    'lecture notes',
  ],
  authors: [{ name: 'MLYTAS' }],
  openGraph: {
    title: 'MLYTAS | Multilingual Audio Summarizer',
    description: 'Transcribe audio files and generate AI-powered summaries, topic segments, and multilingual translation.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MLYTAS | Multilingual Audio Summarizer',
    description: 'AI-powered audio transcription, summary, and multilingual translation.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06061a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <div className="app-wrapper">
          {children}
        </div>
      </body>
    </html>
  );
}
