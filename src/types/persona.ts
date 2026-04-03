export interface Persona {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  systemPrompt: string;
  hasRag?: boolean;
  rulesFile?: string;
  background?: string;
  philosophy?: string;
  riskTolerance?: "Low" | "Medium" | "High";
}
