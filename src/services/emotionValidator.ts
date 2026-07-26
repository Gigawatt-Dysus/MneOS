export interface EmotionVector {
  "Major Emotional State": string;
  "Minor Valence": string;
  Description: string;
  Valence: number;
  Arousal: number;
  FACS?: string[];
  Intensity_Tiers?: Record<string, string>;
  Content_Level?: "Vanilla" | "Sensual" | "Explicit" | "Kink" | "Hardcore";
  Is_Adult?: boolean;
  Kink_Categories?: string[];
  Vanilla_Alternative?: string;
}

export interface ValidationResult {
  isValid: boolean;
  conflicts: string[];
}

export function validateEmotions(emotions: EmotionVector[]): ValidationResult {
  if (emotions.length < 2) return { isValid: true, conflicts: [] };

  const conflicts: string[] = [];
  
  for (let i = 0; i < emotions.length; i++) {
    for (let j = i + 1; j < emotions.length; j++) {
      const e1 = emotions[i];
      const e2 = emotions[j];
      
      const valenceDiff = Math.abs(e1.Valence - e2.Valence);
      const arousalDiff = Math.abs(e1.Arousal - e2.Arousal);
      
      // If Valence is diametrically opposed (e.g. 0.8 and -0.8 -> diff 1.6)
      // A threshold of 1.2 or higher typically means they are on opposite ends of the spectrum
      if (valenceDiff >= 1.2) {
        conflicts.push(`Conflict Detected: "${e1['Minor Valence']}" and "${e2['Minor Valence']}" have diametrically opposed Valences. This will cause LLM hallucinations.`);
      }
      
      // If Arousal is diametrically opposed (e.g., extremely active vs completely dead)
      if (arousalDiff >= 1.2) {
        conflicts.push(`Conflict Detected: "${e1['Minor Valence']}" and "${e2['Minor Valence']}" have fundamentally incompatible Arousal levels.`);
      }
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts
  };
}
