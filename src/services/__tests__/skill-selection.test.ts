import { EMBEDDED_DATA } from '../../embedded-data.js';

/**
 * A retrieval proxy for skill selection. Assistants pick an on-demand skill from its
 * name and description alone, so a realistic task prompt must rank the intended
 * guideline near the top when scored against descriptions (BM25). This does not replace
 * testing with a real assistant; it catches vague, overlapping or regressed descriptions.
 */

const STOP = new Set('a an and the to of for in on with is are be it this that from by as at or when use add new my our i we should how do does can need want into out'.split(' '));

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .split(' ')
    .map(t => t.replace(/^\.+|\.+$/g, ''))
    .filter(t => t.length > 1 && !STOP.has(t))
    .map(t => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t));
}

const ON_DEMAND_EXCLUDED = new Set(['Language', 'Code Style', 'Error Handling', 'Testing']);

const candidates = Object.entries(EMBEDDED_DATA.mappings)
  .filter(([, m]) => !ON_DEMAND_EXCLUDED.has(m.category ?? '') && !m.languages?.length)
  .map(([id, m]) => ({ id, terms: tokens(`${m.description ?? ''} ${(m.tags ?? []).join(' ')} ${id.replace(/-/g, ' ')}`) }));

const N = candidates.length;
const avgLen = candidates.reduce((sum, c) => sum + c.terms.length, 0) / N;
const docFreq = new Map<string, number>();
for (const c of candidates) for (const t of new Set(c.terms)) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);

function rank(prompt: string): string[] {
  const query = tokens(prompt);
  return candidates
    .map(c => {
      let score = 0;
      for (const term of new Set(query)) {
        const tf = c.terms.filter(t => t === term).length;
        if (!tf) continue;
        const df = docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (c.terms.length / avgLen)));
      }
      return { id: c.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(r => r.id);
}

const TASKS: Array<[string, string]> = [
  ['A query on the orders table is slow, how should I add an index?', 'database-indexing'],
  ['Create a migration that adds a new table with foreign keys and constraints', 'database-schema'],
  ['Add pagination with a cursor to the list endpoint', 'api-pagination'],
  ['We need to make a breaking change to our public API and deprecate the old version', 'api-versioning'],
  ['Design the REST endpoints and status codes for a bookings resource', 'api-rest'],
  ['Our login endpoint needs password hashing and JWT tokens', 'security-auth-jwt'],
  ['Where should I store the API keys and database password? Add a .env file', 'security-secrets'],
  ['User input goes into a SQL query and a shell command, prevent injection', 'security-injection'],
  ['Set CSP, CORS and HSTS headers on the web server', 'security-headers'],
  ['I am adding a new npm dependency and updating the lockfile', 'security-supply-chain'],
  ['Configure which commands the AI coding agent may run and review its generated code', 'security-ai-agents'],
  ['Write a GitHub Actions pipeline that builds, tests and deploys with a canary rollout', 'devops-ci-cd'],
  ['Add structured logging, metrics and distributed tracing with OpenTelemetry', 'devops-observability'],
  ['Put a Redis cache in front of the product lookup with a TTL', 'performance-caching'],
  ['Should we use cache-aside or write-through, and how do we invalidate entries?', 'performance-caching-strategies'],
  ['Fetching these many API calls one by one is slow, run them in parallel with a concurrency limit', 'performance-async'],
  ['The page does an N+1 query and loads too much data, find the bottleneck', 'performance-basics'],
  ['Split the monolith into services, how do I size and bound each microservice?', 'microservices-boundaries'],
  ['Our service keeps calling a failing dependency, add retries with backoff and a circuit breaker', 'microservices-resilience'],
  ['Each service needs its own database and a saga for the order workflow', 'microservices-data'],
  ['Add an outbox and a message queue consumer for domain events', 'event-driven-messaging'],
  ['Model the Order aggregate with value objects and domain events', 'ddd-tactical'],
  ['Define the ubiquitous language and bounded contexts with a context map', 'ddd-strategic'],
  ['Ports and adapters: add a driven port for the payment gateway', 'hexagonal-architecture'],
  ['Which layer should hold the business rules, presentation, domain or data access?', 'layered-architecture'],
  ['Wrap the new checkout behind a feature flag for gradual rollout', 'feature-toggles'],
  ['Add optimistic locking so concurrent updates do not overwrite each other', 'patterns-concurrency'],
  ['Introduce a repository and unit of work for persistence', 'patterns-data-access'],
  ['Which design pattern fits: strategy, factory or observer?', 'patterns-gof'],
  ['Review this pull request and write the PR description', 'practices-code-review'],
  ['Clean up this long method and remove the duplicate code', 'practices-refactoring'],
  ['What branch strategy and commit message format should we use?', 'practices-version-control'],
  ['Break the feature into phases and ask clarifying questions before coding', 'practices-planning'],
  ['Structure the MongoDB documents and decide between embedding and referencing', 'database-nosql'],
  ['Design the serverless function so cold starts stay small', 'serverless-best-practices'],
  ['Build the screen with MVVM and bind the view to a view model', 'gui-architecture'],
];

describe('skill selection from descriptions (retrieval proxy)', () => {
  const results = TASKS.map(([prompt, expected]) => ({ prompt, expected, ranked: rank(prompt) }));

  it('every expected guideline exists among the on-demand candidates', () => {
    const ids = new Set(candidates.map(c => c.id));
    expect(TASKS.filter(([, expected]) => !ids.has(expected)).map(([, e]) => e)).toEqual([]);
  });

  it('ranks the intended guideline first for most tasks and in the top three for nearly all', () => {
    const top1 = results.filter(r => r.ranked[0] === r.expected).length / results.length;
    const top3 = results.filter(r => r.ranked.slice(0, 3).includes(r.expected)).length / results.length;
    const misses = results
      .filter(r => !r.ranked.slice(0, 3).includes(r.expected))
      .map(r => `${r.expected} <- "${r.prompt}" got ${r.ranked.slice(0, 3).join(', ')}`);

    // eslint-disable-next-line no-console
    if (process.env.SKILL_SELECTION_REPORT) console.log({ top1, top3, misses });
    expect(misses).toEqual([]);
    expect(top1).toBeGreaterThanOrEqual(0.75);
    expect(top3).toBeGreaterThanOrEqual(0.95);
  });
});
