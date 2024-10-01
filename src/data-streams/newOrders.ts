import WebSocket from "ws";
import fs from "fs";
import { DateTime } from "luxon";
import chalk from "chalk";
import notifier from "node-notifier";

// Websocket url from Binance
const websocketUrlBase = "wss://fstream.binance.com/ws/";

// List of symbols you want to track and where to save it
const symbols = ["xrpusdt", "btcusdt"];
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
        let trophy = tradeType === "BUY" ? "🤑" : "😡";

        if (usdSize >= 500000) {
          trophy = tradeType === "BUY" ? "🚀" : "🐻";
          color = tradeType === "SELL" ? chalk.redBright : chalk.greenBright;
        } else if (usdSize >= 100000) {
          trophy = tradeType === "BUY" ? "🔥" : "🐻";
        }

        // Notify whale order
        if (usdSize >= 1_000_000) {
          notifier.notify({
            title: `${trophy} Whale ${tradeType} order for ${displaySymbol}`,
            message: `$${usdSize.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })} `,
            sound: true,
          });
        }

        const output = `${trophy} ${tradeType} ${displaySymbol} ${readableTradeTime} $${usdSize.toLocaleString(
          "en-US",
          { maximumFractionDigits: 0 }
        )} `;
        const coloredOutput = color(output);

        // Output the order to console
        console.log(coloredOutput);

        // Log the order in the CSV file
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
  // Create a connection for each symbol trade stream
  for (const symbol of symbols) {
    const streamUrl = `${websocketUrlBase}${symbol}@aggTrade`;
    binanceTradeStream(streamUrl, symbol, tradesFilename);
  }
}

main().catch(console.error);
