export interface PromptTemplate {
  id: string;
  emoji: string;
  label: string;
  prompt: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'investment-suggestions',
    emoji: '💡',
    label: 'Investment Suggestions',
    prompt:
      'Based on my investment strategy and your core philosophy, suggest specific tickers to buy or sell. Consider my current holdings, sector targets, and risk tolerance.',
  },
  {
    id: 'financial-analysis',
    emoji: '📊',
    label: 'Financial Analysis',
    prompt:
      'Analyze my entire financial situation — investments, net worth, and cash flow (budget vs. actual). Identify strengths, risks, and suggest adjustments.',
  },
  {
    id: 'portfolio-rebalancing',
    emoji: '⚖️',
    label: 'Portfolio Rebalancing',
    prompt:
      'Review my portfolio against my target allocations and suggest specific buy/sell orders to rebalance. Prioritize actions by impact and alignment with my strategy.',
  },
  {
    id: 'financial-health-audit',
    emoji: '🏥',
    label: 'Financial Health Audit',
    prompt:
      'Perform a complete financial health audit — assets beyond investments, total net worth, cash flow (budgeted vs. actual), debt ratios, and emergency fund adequacy. Recommend changes.',
  },
];
