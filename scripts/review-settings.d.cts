export interface ReviewSuite {
  name: string;
  config: string;
  framework?: string;
}

export const FRAMEWORKS: string[];
export const REVIEW_SUITES: ReviewSuite[];
export function runnerOutputDir(suite: string, env?: NodeJS.ProcessEnv): string;
