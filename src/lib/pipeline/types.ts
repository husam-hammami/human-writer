export interface PipelineConfig {
  tone: 'academic-formal' | 'academic-conversational' | 'reflective' | 'casual-analytical';
  academicLevel: 'undergraduate' | 'postgraduate' | 'doctoral';
  wordCount: number;
  citationStyle: 'chicago-18th' | 'apa-7th' | 'harvard' | 'mla' | 'none';
  discipline: string;
  temperature?: number;
}

export interface RubricCriterion {
  criterion: string;
  weight: number;
  description: string;
}

export interface ParsedBrief {
  title: string;
  requirements: string[];
  rubricCriteria: RubricCriterion[];
  keyTopics: string[];
  discipline: string;
  suggestedWordCount: number;
  sections: string[];
}

export interface OutlineSection {
  title: string;
  targetWords: number;
  keyPoints: string[];
  order: number;
}

export interface Outline {
  title: string;
  sections: OutlineSection[];
  totalWords: number;
}

export interface GeneratedSection {
  title: string;
  content: string;
  wordCount: number;
}

export interface DetectionResult {
  humanScore: number;
  aiScore: number;
  provider: string;
  paragraphScores: {
    text: string;
    humanScore: number;
    index: number;
  }[];
}

export interface PolishChange {
  pass: string;
  original: string;
  replacement: string;
  position: number;
}

export interface PolishResult {
  polishedText: string;
  changes: PolishChange[];
  stats: {
    sentenceLengthDistribution: { short: number; medium: number; long: number; veryLong: number };
    theStarterPercentage: number;
    avgSentencesPerParagraph: number;
    passiveVoicePercentage: number;
    bannedPhrasesRemoved: number;
    contractionsExpanded: number;
  };
}

export interface IterationState {
  iteration: number;
  maxIterations: number;
  failingParagraphs: number[];
  scores: number[];
  status: 'checking' | 'regenerating' | 'polishing' | 'rechecking' | 'complete';
}

export interface PipelineState {
  stage: 'idle' | 'parsing' | 'outlining' | 'drafting' | 'paraphrasing' | 'polishing' | 'detecting' | 'iterating' | 'complete' | 'error';
  parsedBrief: ParsedBrief | null;
  outline: Outline | null;
  draftSections: GeneratedSection[];
  fullDraft: string;
  polishedText: string;
  detectionResult: DetectionResult | null;
  iterationState: IterationState | null;
  error: string | null;
}
