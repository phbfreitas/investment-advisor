export interface ParsedHolding {
    ticker: string;
    quantity: number;
    bookCost: number;
    marketValue: number;
    accountNumber: string;
    accountType: string; // "Registered" or "Non-Registered"
    currency: string;
}

type CurrencyCode = "USD" | "CAD";

type CurrencyConfig = {
    code: CurrencyCode;
    sectionRegex: RegExp;
    inlineToken: RegExp;
    documentRegex: RegExp;
};

const CURRENCY_CONFIGS: CurrencyConfig[] = [
    {
        code: "CAD",
        sectionRegex: /Canadian\s*Dollar\s*(?:Holdings|Securities|Account)?/i,
        inlineToken: /\bCAD\b/i,
        documentRegex: /CAD|Canadian/i,
    },
    {
        code: "USD",
        sectionRegex: /U\.?S\.?\s*Dollar\s*(?:Holdings|Securities|Account)?/i,
        inlineToken: /\bUSD\b/i,
        documentRegex: /USD|U\.?S\.?\s*Dollar/i,
    },
];

function detectDocumentDefaultCurrency(text: string): CurrencyCode {
    for (const cfg of CURRENCY_CONFIGS) {
        if (cfg.documentRegex.test(text)) return cfg.code;
    }
    return "USD";
}

function detectSectionCurrency(line: string): CurrencyCode | null {
    for (const cfg of CURRENCY_CONFIGS) {
        if (cfg.sectionRegex.test(line)) return cfg.code;
    }
    return null;
}

// Detect account type from text context
function classifyAccountType(text: string): string {
    const upper = text.toUpperCase();
    if (/TFSA|RRSP|RESP|RDSP|FHSA|LIRA|LIF|RRIF|DPSP/.test(upper)) return "Registered";
    if (/NON.?REG|MARGIN|CASH\s*ACCOUNT|TAXABLE/.test(upper)) return "Non-Registered";
    return "";
}

// Extract account number patterns
export function extractAccountNumber(text: string): string {
    // Common patterns: "Account: 12345", "Account #: ABC123", "Acct# 12345"
    const patterns = [
        /Account No\.[^\n]*\n\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,15})\b/i,
        /(?:^|\n)\s*#?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,15})\s*(?:TFSA|RRSP|Non|Margin|Cash)/im,
        /Account\s*(?:#|Number|No\.?)?\s*:?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{4,15})/i,
        /Acct\s*#?\s*:?\s*:?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{4,15})/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            console.log("EXTRACTED ACCOUNT NUMBER: ", match[1], "using pattern:", pattern);
            return match[1];
        }
    }
    console.log("NO ACCOUNT NUMBER EXTRACTED FROM PDF!");
    return "";
}

export function parseHoldings(text: string): ParsedHolding[] {
    const holdings: ParsedHolding[] = [];
    const accountNumber = extractAccountNumber(text);
    const accountType = classifyAccountType(text);

    // Detect currency from document
    const documentDefault = detectDocumentDefaultCurrency(text);
    let sectionCurrency: CurrencyCode | null = null;

    // Split into lines for row-by-row parsing
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Standard Pattern: TICKER.TO or TICKER followed by numbers (qty, cost, value)
    // Safe generic holding pattern (Ticker Qty Price Value)
    const holdingPattern = /^([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+\$?([\d,]+(?:\.\d{2})?)\s+\$?([\d,]+(?:\.\d{2})?)/;

    // Wealthsimple holdings line pattern (Ticker followed by at least 3 numeric quantities)
    const wsQtyPattern = /(?:^|\s)([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*(?:\.\d+)?)(?:\s|$)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for section header to update currency context
        const headerMatch = detectSectionCurrency(line);
        if (headerMatch !== null) {
            sectionCurrency = headerMatch;
            continue;
        }

        // 1. Try generic safe pattern
        const match = line.match(holdingPattern);
        if (match) {
            const ticker = match[1];
            const quantity = parseFloat(match[2].replace(/,/g, ''));
            const bookCost = parseFloat(match[3].replace(/,/g, ''));
            const marketValue = parseFloat(match[4].replace(/,/g, ''));

            if (quantity > 0 && !isNaN(bookCost) && !isNaN(marketValue)) {
                if (!holdings.some(h => h.ticker === ticker)) {
                    holdings.push({ ticker, quantity, bookCost, marketValue, accountNumber, accountType, currency: sectionCurrency ?? documentDefault });
                }
            }
            continue;
        }

        // 2. Try Wealthsimple specific pattern
        const wsMatch = line.match(wsQtyPattern);
        if (wsMatch) {
            if (line.includes("RECALL") || line.includes("LOAN") || line.includes("terminated")) continue;

            const ticker = wsMatch[1];
            const quantity = parseFloat(wsMatch[2].replace(/,/g, ''));
            const dollarAmounts: number[] = [];
            const dollarPattern = /\$([\d,]+(?:\.\d{2})?)/g;

            let execMatch;
            while ((execMatch = dollarPattern.exec(line)) !== null) {
                dollarAmounts.push(parseFloat(execMatch[1].replace(/,/g, '')));
            }

            for (let j = 1; j <= 6 && (i + j) < lines.length; j++) {
                if (lines[i+j].match(wsQtyPattern) && !lines[i+j].includes("RECALL") && !lines[i+j].includes("LOAN")) break;
                let nextMatch;
                while ((nextMatch = dollarPattern.exec(lines[i+j])) !== null) {
                    dollarAmounts.push(parseFloat(nextMatch[1].replace(/,/g, '')));
                }
            }

            if (dollarAmounts.length >= 3) {
                const marketValue = dollarAmounts[1];
                const bookCost = dollarAmounts[2];

                if (quantity > 0 && !isNaN(bookCost) && !isNaN(marketValue)) {
                    if (!holdings.some(h => h.ticker === ticker)) {
                        holdings.push({ ticker, quantity, bookCost, marketValue, accountNumber, accountType, currency: sectionCurrency ?? documentDefault });
                    }
                }
            }
        }
    }

    return holdings;
}
