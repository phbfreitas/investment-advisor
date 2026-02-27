import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { SchemaType, FunctionDeclaration } from "@google/generative-ai";

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
export async function fetchStockData(ticker: string) {
  try {
    const result = await yahooFinance.quote(ticker) as any;

    if (!result) {
      return { error: `Could not find data for ticker: ${ticker}` };
    }

    return {
      ticker: result.symbol,
      longName: result.longName || result.shortName,
      currentPrice: result.regularMarketPrice,
      currency: result.currency,
      dayChange: result.regularMarketChange,
      dayChangePercent: result.regularMarketChangePercent,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow,
      marketCap: result.marketCap,
      trailingPE: result.trailingPE,
      forwardPE: result.forwardPE,
      dividendYield: result.dividendYield,
    };
  } catch (error: any) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return { error: `Failed to retrieve data for ${ticker}. Reason: ${error.message}` };
  }
}
