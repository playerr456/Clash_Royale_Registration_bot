const { hasRegistrationFolder, saveRegistrationFile } = require("../lib/blob-store");
const { CHANNEL_CHAT_ID, CHANNEL_URL } = require("../lib/config");
const { studentExists } = require("../lib/excel");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { getChatMember, sendMessage } = require("../lib/telegram");
const { validateRegistration } = require("../lib/validation");
const { verifyInitData } = require("../lib/webapp-auth");

function isSubscribedToChannel(chatMember) {
  if (!chatMember || typeof chatMember.status !== "string") {
    return false;
  }

  if (chatMember.status === "left" || chatMember.status === "kicked") {
    return false;
  }

  if (chatMember.status === "restricted") {
    return Boolean(chatMember.is_member);
  }

  return ["member", "administrator", "creator"].includes(chatMember.status);
}

function buildChannelSubscribeMarkup() {
  if (!CHANNEL_URL) {
    return undefined;
  }

  return {
    inline_keyboard: [
      [
        {
          text: "Подписаться на канал",
          url: CHANNEL_URL
        }
      ]
    ]
  };
}

module.exports = async function registerHandler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (_error) {
    return sendJson(res, 400, { ok: false, error: "Некорректный JSON." });
  }

  const auth = verifyInitData(payload.initData);
  if (!auth.ok) {
    return sendJson(res, 401, { ok: false, error: auth.error });
  }

  const tgId = String(auth.user.id);
  const userId = Number(auth.user.id);
  const mode = payload.mode === "edit" ? "edit" : "new";
  const validation = validateRegistration(payload);

  if (!validation.ok) {
    return sendJson(res, 400, { ok: false, errors: validation.errors });
  }

  const { fullName, groupNumber, crId, crNickname } = validation.value;

  if (CHANNEL_CHAT_ID) {
    let channelMember;
    try {
      channelMember = await getChatMember(CHANNEL_CHAT_ID, userId);
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: `Не удалось проверить подписку на канал: ${error.message}`
      });
    }

    if (!isSubscribedToChannel(channelMember)) {
      try {
        await sendMessage(
          tgId,
          "Чтобы завершить регистрацию, необходимо подписаться на канал.",
          buildChannelSubscribeMarkup()
        );
      } catch (_error) {
        // Ignore telegram send errors.
      }

      return sendJson(res, 403, {
        ok: false,
        needSubscribe: true,
        error: "Чтобы завершить регистрацию, подпишитесь на канал и повторите отправку формы."
      });
    }
  }

  let existsInUsersTable = false;
  try {
    existsInUsersTable = await studentExists(fullName, groupNumber);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Ошибка чтения mephi_users.xlsx: ${error.message}`
    });
  }

  if (!existsInUsersTable) {
    return sendJson(res, 403, {
      ok: false,
      error: "Пожалуйста, проверьте правильность написания ФИО и группы."
    });
  }

  let hasExistingRegistration = false;
  try {
    hasExistingRegistration = await hasRegistrationFolder(tgId);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Ошибка доступа к Blob: ${error.message}`
    });
  }

  if (hasExistingRegistration && mode !== "edit") {
    return sendJson(res, 409, {
      ok: false,
      needChange: true,
      error: "Вы уже зарегистрированы. Нажмите кнопку «Изменить регистрацию» в боте."
    });
  }

  const timestampMs = Date.now();
  const operation = hasExistingRegistration ? "edit" : "new";
  const content = [
    `tg id: ${tgId}`,
    `operation: ${operation}`,
    `фио: ${fullName}`,
    `номер группы: ${groupNumber}`,
    `CR тэг: ${crId}`,
    `CR nickname: ${crNickname}`,
    `timestamp: ${timestampMs}`
  ].join("\n");

  try {
    await saveRegistrationFile(tgId, timestampMs, content);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Не удалось сохранить запись в Blob: ${error.message}`
    });
  }

  try {
    await sendMessage(
      tgId,
      "Регистрация успешно завершена."
    );
  } catch (_error) {
    // Ignored intentionally, registration is already saved.
  }

  return sendJson(res, 200, {
    ok: true,
    tgId,
    timestamp: timestampMs
  });
};
