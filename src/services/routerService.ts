import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

export type QueryRoute =
  | 'summarization'
  | 'table_extraction'
  | 'key_points'
  | 'specific_question'
  | 'comparison'
  | 'definition';

export interface RoutingResult {
  route: QueryRoute;
  confidence: number;
  scores: Record<QueryRoute, number>;
}

const ROUTE_LABELS: Record<QueryRoute, string> = {
  summarization: 'a request to summarize or give an overview of the document',
  table_extraction: 'a request to extract table data, numbers, or statistics',
  key_points: 'a request for key points, main ideas, or highlights',
  specific_question: 'a specific question about particular content in the document',
  comparison: 'a request to compare or contrast items or concepts',
  definition: 'a request for a definition or explanation of a term',
};

let classifierPromise: Promise<any> | null = null;

const getClassifier = async () => {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      'zero-shot-classification',
      'Xenova/distilbert-base-uncased-mnli',
      { device: 'wasm' }
    );
  }
  return classifierPromise;
};

export const routeQuery = async (question: string): Promise<RoutingResult> => {
  const normalizedQuestion = question.toLowerCase().trim();
  const directRoute = getDirectRoute(normalizedQuestion);

  if (directRoute) {
    return {
      route: directRoute,
      confidence: 0.99,
      scores: { ...createEmptyScores(), [directRoute]: 0.99 },
    };
  }

  const classifier = await getClassifier();
  const labels = Object.keys(ROUTE_LABELS) as QueryRoute[];
  const candidateTexts = labels.map(l => ROUTE_LABELS[l]);

  const output = await classifier(question, candidateTexts);

  const scores: Record<QueryRoute, number> = {} as Record<QueryRoute, number>;
  let bestRoute: QueryRoute = 'specific_question';
  let bestScore = -1;

  for (let i = 0; i < output.labels.length; i++) {
    const label = output.labels[i] as QueryRoute;
    const score = output.scores[i] as number;
    scores[label] = score;
    if (score > bestScore) {
      bestScore = score;
      bestRoute = label;
    }
  }

  return {
    route: bestRoute,
    confidence: bestScore,
    scores,
  };
};

const createEmptyScores = (): Record<QueryRoute, number> => ({
  summarization: 0,
  table_extraction: 0,
  key_points: 0,
  specific_question: 0,
  comparison: 0,
  definition: 0,
});

const getDirectRoute = (question: string): QueryRoute | null => {
  if (/\b(summary|summarize|overview|brief|describe)\b/.test(question)) {
    return 'summarization';
  }

  if (/\b(table|rows|columns|spreadsheet|csv|excel|extract|statistics|stats)\b/.test(question) &&
      /\b(show|list|extract|display|give|what|which|how many|statistics|stats)\b/.test(question)) {
    return 'table_extraction';
  }

  if (/\b(key points|main points|highlights|takeaways|main ideas)\b/.test(question)) {
    return 'key_points';
  }

  if (/\b(compare|comparison|difference|similar|versus|vs\.)\b/.test(question)) {
    return 'comparison';
  }

  if (/\b(what is|what are|define|definition|meaning of|explain)\b/.test(question)) {
    return 'definition';
  }

  return null;
};
