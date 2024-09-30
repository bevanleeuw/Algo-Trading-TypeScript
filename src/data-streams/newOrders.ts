import WebSocket from "ws";
import fs from "fs";
import { DateTime } from "luxon";
import chalk from "chalk";

// List of symbols you want to track
const symbols = [
  "btcusdt",
  "ethusdt",
  "solusdt",
  "bnbusdt",
  "dogeusdt",
  "wifusdt",
];
const websocketUrlBase = "wss://fstream.binance.com/ws/";
const tradesFilename = "binance_trades.csv";

// Check if the CSV file exists
if (!fs.existsSync(tradesFilename)) {
  fs.writeFileSync(
    tradesFilename,
    "Event Time, Symbol, Aggregate Trade ID, Price, Quantity, First Trade ID, Trade Time, Is Buyer Maker\n"
  );
}

interface TradeData {
  E: number;
  a: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
}

async function binanceTradeStream(
  uri: string,
  symbol: string,
  filename: string
): Promise<void> {
  const ws = new WebSocket(uri);

  ws.on("message", (message: string) => {
    try {
      const data: TradeData = JSON.parse(message);
      const eventTime = data.E;
      const aggTradeId = data.a;
      const price = parseFloat(data.p);
      const quantity = parseFloat(data.q);
      const tradeTime = data.T;
      const isBuyerMaker = data.m;
      const est = DateTime.fromMillis(tradeTime).setZone("America/New_York");
      const readableTradeTime = est.toFormat("HH:mm:ss");
      const usdSize = price * quantity;
      const displaySymbol = symbol.toUpperCase().replace("USDT", "");

      if (usdSize > 14999) {
        const tradeType = isBuyerMaker ? "SELL" : "BUY";
        let color = tradeType === "SELL" ? chalk.red : chalk.green;
        let stars = "";
        let bold = false;
        let repeat = 1;

        if (usdSize >= 500000) {
          stars = "**";
          repeat = 1;
          color = tradeType === "SELL" ? chalk.magenta : chalk.blue;
        } else if (usdSize >= 100000) {
          stars = "*";
          repeat = 1;
        }

        if (usdSize >= 50000) {
          bold = true;
        }

        const output = `${stars} ${tradeType} ${displaySymbol} ${readableTradeTime} $${usdSize.toLocaleString(
          "en-US",
          { maximumFractionDigits: 0 }
        )} `;
        const coloredOutput = color(output);
        const finalOutput = bold ? chalk.bold(coloredOutput) : coloredOutput;

        for (let i = 0; i < repeat; i++) {
          console.log(finalOutput);
        }

        // Log to CSV
        fs.appendFileSync(
          filename,
          `${eventTime},${symbol.toUpperCase()},${aggTradeId},${price},${quantity},${tradeTime},${isBuyerMaker}\n`
        );
      }
    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  ws.on("error", console.error);

  ws.on("close", () => {
    console.log(`WebSocket closed for ${symbol}. Attempting to reconnect...`);
    setTimeout(() => binanceTradeStream(uri, symbol, filename), 5000);
  });
}

async function main() {
  const filename = "binance_trades.csv";

  // Create a connection for each symbol trade stream
  for (const symbol of symbols) {
    const streamUrl = `${websocketUrlBase}${symbol}@aggTrade`;
    binanceTradeStream(streamUrl, symbol, filename);
  }
}

main().catch(console.error);
