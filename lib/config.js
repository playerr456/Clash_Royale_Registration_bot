const fs = require("fs");
const path = require("path");

function normalizeUrl(value) {
  return value ? value.replace(/\/+$/, "") : "";
}

function deriveChannelChatIdFromUrl(url) {
  if (!url) {
    return "";
  }

  const match = String(url).trim().match(/^https?:\/\/t\.me\/([A-Za-z0-9_]{5,})$/i);
  if (!match) {
    return "";
  }

  return `@${match[1]}`;
}

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readBotToken() {
  const tokenFromEnv = readEnv([
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAMM_BOT_TOEN_CR_REG",
    "TELEGRAM_BOT_TOEN_CR_REG"
  ]);
  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  const localTokenPath = path.join(process.cwd(), "bot_token.env");
  if (fs.existsSync(localTokenPath)) {
    const token = fs.readFileSync(localTokenPath, "utf8").trim();
    if (token) {
      return token;
    }
  }

  throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
}

const BOT_TOKEN = readBotToken();

const BASE_URL = normalizeUrl(
  readEnv(["BASE_URL", "BASE_URL_CR_REG"]) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
);

const WEBAPP_URL = normalizeUrl(
  readEnv(["WEBAPP_URL", "WEBAPP_URL_CR_REG"]) || (BASE_URL ? `${BASE_URL}/miniapp` : "")
);
const CHANNEL_URL = normalizeUrl(
  readEnv([
    "CHANNEL_URL",
    "CHANNEL_URL_CR_REG",
    "TELEGRAM_CHANNEL_URL",
    "TELEGRAM_CHANNEL_URL_CR_REG"
  ]) || "https://t.me/esportsMEPHI"
);
const CHANNEL_CHAT_ID = readEnv([
  "CHANNEL_CHAT_ID",
  "CHANNEL_CHAT_ID_CR_REG",
  "TELEGRAM_CHANNEL_CHAT_ID",
  "TELEGRAM_CHANNEL_CHAT_ID_CR_REG"
]) || deriveChannelChatIdFromUrl(CHANNEL_URL);

const TELEGRAM_WEBHOOK_SECRET = readEnv([
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_WEBHOOK_SECRET_CR_REG"
]);
const SET_WEBHOOK_KEY = readEnv(["SET_WEBHOOK_KEY", "SET_WEBHOOK_KEY_CR_REG"]);

// @vercel/blob reads BLOB_READ_WRITE_TOKEN only.
const blobToken = readEnv(["BLOB_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN_CR_REG"]);
if (blobToken && !process.env.BLOB_READ_WRITE_TOKEN) {
  process.env.BLOB_READ_WRITE_TOKEN = blobToken;
}

module.exports = {
  BASE_URL,
  BOT_TOKEN,
  CHANNEL_CHAT_ID,
  CHANNEL_URL,
  SET_WEBHOOK_KEY,
  TELEGRAM_WEBHOOK_SECRET,
  WEBAPP_URL
};
