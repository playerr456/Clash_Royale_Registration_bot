const { hasRegistrationFolder } = require("../lib/blob-store");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { verifyInitData } = require("../lib/webapp-auth");

module.exports = async function registrationStatusHandler(req, res) {
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
  try {
    const hasRegistration = await hasRegistrationFolder(tgId);
    return sendJson(res, 200, {
      ok: true,
      hasRegistration
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Ошибка проверки регистрации: ${error.message}`
    });
  }
};
