import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export const moderateContent = async (content: string): Promise<{
  flagged: boolean;
  reason?: string;
}> => {
  if (!openai) {
    // No OpenAI key configured, skip moderation
    return { flagged: false };
  }

  try {
    const response = await openai.moderations.create({
      input: content,
    });

    const result = response.results[0];
    
    if (result.flagged) {
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category]) => category);
      
      return {
        flagged: true,
        reason: `Flagged for: ${flaggedCategories.join(', ')}`
      };
    }

    return { flagged: false };
  } catch (error) {
    console.error('OpenAI moderation error:', error);
    // Fail open - don't block comments if moderation fails
    return { flagged: false };
  }
};