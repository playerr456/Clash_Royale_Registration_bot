const { BOT_TOKEN } = require("./config");

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function telegramRequest(method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({
    ok: false,
    description: "Invalid response from Telegram API."
  }));

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed.`);
  }

  return data.result;
}

async function sendMessage(chatId, text, replyMarkup) {
  const payload = {
    chat_id: chatId,
    text
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return telegramRequest("sendMessage", payload);
}

async function getChatMember(chatId, userId) {
  return telegramRequest("getChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

async function setWebhook(url, secretToken) {
  const payload = {
    url
  };

  if (secretToken) {
    payload.secret_token = secretToken;
  }

  return telegramRequest("setWebhook", payload);
}

module.exports = {
  getChatMember,
  sendMessage,
  setWebhook
};
