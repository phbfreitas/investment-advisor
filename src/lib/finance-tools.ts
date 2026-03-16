import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { SchemaType, FunctionDeclaration } from "@google/generative-ai";
import type { MarketData } from "@/types";

interface YahooQuoteResult {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice: number;
  currency: string;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
}

/**
 * Definition of the tool that the LLM will be aware of to fetch stock data.
 */
export const fetchStockDataToolDefinition: FunctionDeclaration = {
  name: "fetchStockData",
  description: "Fetches current market data for a given stock ticker symbol (e.g., AAPL, MSFT, TSLA). Use this whenever the user asks about a specific public company or you need to know the current price to evaluate their portfolio.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      ticker: {
        type: SchemaType.STRING,
        description: "The stock ticker symbol to look up (e.g., AAPL, AMZN, GOOGL).",
      },
    },
    required: ["ticker"],
  },
};

/**
 * Executes the actual data fetch using the yahoo-finance2 library.
 */
export async function fetchStockData(ticker: string): Promise<MarketData> {
  try {
    const result = await yahooFinance.quote(ticker) as YahooQuoteResult | null;

    if (!result) {
      return { error: `Could not find data for ticker: ${ticker}` } as MarketData;
    }

    return {
      ticker: result.symbol,
      longName: result.longName ?? result.shortName ?? null,
      currentPrice: result.regularMarketPrice,
      currency: result.currency,
      dayChange: result.regularMarketChange,
      dayChangePercent: result.regularMarketChangePercent,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow,
      marketCap: result.marketCap,
      trailingPE: result.trailingPE ?? null,
      forwardPE: result.forwardPE ?? null,
      dividendYield: result.dividendYield ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching data for ${ticker}:`, error);
    return { error: `Failed to retrieve data for ${ticker}. Reason: ${message}` } as MarketData;
  }
}
