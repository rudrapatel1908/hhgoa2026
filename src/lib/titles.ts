// lib/titles.ts
// Zero-latency local title generator. This is the PRIMARY path — not a fallback.
// An LLM-backed /api/generate-title can be layered in later as an optional
// "regenerate with AI" upgrade, but the product must work perfectly with zero
// network calls.

const MODIFIERS = [
  "Async", "Chaotic", "Recursive", "Distributed", "Feral", "Nocturnal",
  "Caffeinated", "Stateless", "Overclocked", "Rogue", "Quantum", "Idempotent",
  "Sleep-Deprived", "Self-Hosted", "Undocumented", "Edge-Case", "Bare-Metal",
  "Zero-Downtime", "Off-Grid", "Battle-Tested",
];

const ROLE_NOUNS: Record<string, string[]> = {
  default: ["Builder", "Shipper", "Hacker", "Architect", "Operative"],
  frontend: ["Pixel Wrangler", "DOM Whisperer", "UI Alchemist", "Layout Sorcerer"],
  backend: ["API Smith", "Query Tamer", "Server Whisperer", "Route Architect"],
  fullstack: ["Stack Whisperer", "Full-Stack Chaos Agent", "Layer Zero Operative"],
  design: ["Pixel Perfectionist", "Interface Alchemist", "Grid Whisperer"],
  ml: ["Gradient Chaser", "Tensor Wrangler", "Model Whisperer", "Weight Smuggler"],
  blockchain: ["Chain Whisperer", "Gas Fee Gladiator", "Block Smith", "Ledger Rogue"],
  product: ["Roadmap Rogue", "Scope Smuggler", "Ship-It Strategist"],
  security: ["Exploit Whisperer", "Threat Wrangler", "Firewall Ghost"],
  devops: ["Pipeline Wrangler", "Uptime Guardian", "Deploy Gremlin"],
};

/** Very loose keyword match from a free-text stack/role string to a noun bucket. */
function pickBucket(stack: string): string[] {
  const s = stack.toLowerCase();
  if (/(react|next|vue|svelte|frontend|css|tailwind)/.test(s)) return ROLE_NOUNS.frontend;
  if (/(node|django|flask|fastapi|backend|golang|rust api|server)/.test(s)) return ROLE_NOUNS.backend;
  if (/(full[\s-]?stack)/.test(s)) return ROLE_NOUNS.fullstack;
  if (/(design|figma|ux|ui\b)/.test(s)) return ROLE_NOUNS.design;
  if (/(ml|ai\b|pytorch|tensorflow|llm|model)/.test(s)) return ROLE_NOUNS.ml;
  if (/(blockchain|web3|solidity|avalanche|evm|smart contract)/.test(s)) return ROLE_NOUNS.blockchain;
  if (/(product|pm\b)/.test(s)) return ROLE_NOUNS.product;
  if (/(security|pentest|infosec)/.test(s)) return ROLE_NOUNS.security;
  if (/(devops|infra|kubernetes|docker|ci\/cd)/.test(s)) return ROLE_NOUNS.devops;
  return ROLE_NOUNS.default;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generates a 2-4 word builder title instantly, no network call. */
export function generateLocalTitle(stack: string): string {
  const bucket = pickBucket(stack);
  const modifier = pick(MODIFIERS);
  const noun = pick(bucket);
  return `${modifier} ${noun}`;
}

/** Generates several distinct options so the UI can offer a "shuffle" control. */
export function generateLocalTitleOptions(stack: string, count = 4): string[] {
  const options = new Set<string>();
  let attempts = 0;
  while (options.size < count && attempts < count * 5) {
    options.add(generateLocalTitle(stack));
    attempts++;
  }
  return Array.from(options);
}