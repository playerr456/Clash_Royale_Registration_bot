const { list } = require("@vercel/blob");
const { sendMessage } = require("../lib/telegram");

const REGISTRATIONS_ROOT = String(process.env.REGISTRATIONS_ROOT || "registrations")
  .replace(/^\/+/, "")
  .replace(/\/+$/, "");

function parseTgIdFromFolder(folderPath) {
  const escapedRoot = REGISTRATIONS_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const folderRegex = new RegExp(`^${escapedRoot}/([^/]+)/$`);
  const match = String(folderPath || "").match(folderRegex);
  return match ? match[1] : "";
}

async function listRegisteredTgIds() {
  const result = new Set();
  let cursor;

  do {
    const response = await list({
      prefix: `${REGISTRATIONS_ROOT}/`,
      mode: "folded",
      limit: 1000,
      cursor
    });

    for (const folder of response.folders || []) {
      const tgId = parseTgIdFromFolder(folder);
      if (tgId) {
        result.add(tgId);
      }
    }

    cursor = response.hasMore ? response.cursor : undefined;
  } while (cursor);

  return Array.from(result);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const textArg = args.filter((arg) => !arg.startsWith("--")).join(" ");
  const messageText = String(textArg || process.env.BROADCAST_TEXT || "123").trim();

  if (!messageText) {
    throw new Error("Пустой текст рассылки. Передайте текст аргументом или через BROADCAST_TEXT.");
  }

  const tgIds = await listRegisteredTgIds();
  if (tgIds.length === 0) {
    console.log("Пользователи в registrations не найдены.");
    return;
  }

  console.log(`Найдено пользователей: ${tgIds.length}`);
  if (dryRun) {
    console.log("Режим dry-run, отправка не выполнялась.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const tgId of tgIds) {
    try {
      await sendMessage(tgId, messageText);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Ошибка отправки для ${tgId}: ${error.message}`);
    }
  }

  console.log(`Рассылка завершена. Успешно: ${sent}. Ошибки: ${failed}.`);
}

main().catch((error) => {
  console.error(`Ошибка рассылки: ${error.message}`);
  process.exit(1);
});
