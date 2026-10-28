import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'MLYTAS | Multilingual YouTube Audio Summarizer',
  description:
    'Summarize any YouTube video in seconds. Get speaker diarization, topic segmentation, actionable insights, and multilingual translation powered by Whisper V3 and AI.',
  keywords: [
    'YouTube summarizer',
    'audio transcription',
    'speaker diarization',
    'multilingual',
    'AI summarization',
    'Whisper',
    'podcast summary',
    'lecture notes',
  ],
  authors: [{ name: 'MLYTAS' }],
  openGraph: {
    title: 'MLYTAS | Multilingual YouTube Audio Summarizer',
    description: 'Summarize any YouTube video in seconds with AI-powered transcription, speaker identification, and multilingual translation.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MLYTAS | YouTube Audio Summarizer',
    description: 'AI-powered YouTube video summarization with speaker diarization and multilingual support.',
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
