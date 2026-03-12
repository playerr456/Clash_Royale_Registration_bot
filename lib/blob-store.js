const { list, put } = require("@vercel/blob");

function normalizeTgId(tgId) {
  return String(tgId || "").trim();
}

async function hasRegistrationFolder(tgId) {
  const normalized = normalizeTgId(tgId);
  if (!normalized) {
    return false;
  }

  const response = await list({
    prefix: `${normalized}/`,
    limit: 1
  });

  return response.blobs.length > 0;
}

async function saveRegistrationFile(tgId, timestampMs, content) {
  const normalized = normalizeTgId(tgId);
  const key = `${normalized}/${timestampMs}.txt`;
  const access = process.env.BLOB_ACCESS === "private" ? "private" : "public";

  return put(key, content, {
    addRandomSuffix: false,
    access,
    contentType: "text/plain; charset=utf-8"
  });
}

module.exports = {
  hasRegistrationFolder,
  saveRegistrationFile
};
