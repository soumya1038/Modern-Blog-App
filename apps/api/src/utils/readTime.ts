import readingTime from 'reading-time';

export const calculateReadTime = (content: string) => {
  const stats = readingTime(content);
  return {
    text: stats.text,
    minutes: Math.ceil(stats.minutes),
    words: stats.words
  };
};