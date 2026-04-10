export const getMovieRecommendation = async (userMood: string): Promise<string> => {
  if (!userMood.trim()) {
    return 'Tell me what kind of movie you are in the mood for.';
  }

  return 'AI recommendations are currently disabled in this build.';
};
