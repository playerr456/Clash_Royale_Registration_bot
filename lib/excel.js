const fs = require("fs");
const path = require("path");
const { get } = require("@vercel/blob");
const XLSX = require("xlsx");
const { normalizeFullName, normalizeGroupNumber } = require("./validation");

const USER_FILE_NAMES = ["mephi_users.xlsx", "mephi_usres.xlsx"];
const DEFAULT_USERS_BLOB_PATHS = ["mephi_db/mephi_users.xlsx", "secure/mephi_users.xlsx"];

let cache = {
  source: "",
  mtimeMs: 0,
  etag: "",
  records: []
};

function findColumnIndex(headers, patterns, fallbackIndex) {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
  return index === -1 ? fallbackIndex : index;
}

function resolveUsersFilePath() {
  for (const fileName of USER_FILE_NAMES) {
    const fullPath = path.join(process.cwd(), fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return path.join(process.cwd(), USER_FILE_NAMES[0]);
}

function extractRecordsFromWorkbook(workbook) {
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0].map((cell) => String(cell || "").trim());
  const fioIndex = findColumnIndex(headers, [/фио/i, /ф\.?\s*и\.?\s*о\.?/i, /name/i], 0);
  let groupIndex = findColumnIndex(headers, [/групп/i, /group/i], 1);
  if (groupIndex === fioIndex) {
    groupIndex = groupIndex === 0 ? 1 : 0;
  }

  const records = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const fullName = normalizeFullName(row[fioIndex]);
    const groupNumber = normalizeGroupNumber(row[groupIndex]);

    if (!fullName || !groupNumber) {
      continue;
    }

    records.push({ fullName, groupNumber });
  }

  return records;
}

async function readBlobToBuffer(pathname, access) {
  const blob = await get(pathname, { access });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    throw new Error(`Users blob is missing: ${pathname}`);
  }

  const reader = blob.stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(Buffer.from(value));
  }

  return {
    buffer: Buffer.concat(chunks),
    etag: blob.blob.etag || ""
  };
}

async function loadRecords() {
  const usersFilePath = resolveUsersFilePath();
  if (fs.existsSync(usersFilePath)) {
    const stat = fs.statSync(usersFilePath);
    if (
      cache.records.length &&
      cache.mtimeMs === stat.mtimeMs &&
      cache.source === `file:${usersFilePath}`
    ) {
      return cache.records;
    }

    const workbook = XLSX.readFile(usersFilePath);
    const records = extractRecordsFromWorkbook(workbook);
    cache = {
      source: `file:${usersFilePath}`,
      mtimeMs: stat.mtimeMs,
      etag: "",
      records
    };
    return records;
  }

  const blobAccess = process.env.USERS_XLSX_BLOB_ACCESS === "public" ? "public" : "private";
  const blobPaths = process.env.USERS_XLSX_BLOB_PATH
    ? [process.env.USERS_XLSX_BLOB_PATH]
    : DEFAULT_USERS_BLOB_PATHS;

  let lastError = null;
  for (const blobPath of blobPaths) {
    const sourceKey = `blob:${blobAccess}:${blobPath}`;
    if (cache.records.length && cache.source === sourceKey) {
      return cache.records;
    }

    try {
      const { buffer, etag } = await readBlobToBuffer(blobPath, blobAccess);
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const records = extractRecordsFromWorkbook(workbook);

      cache = {
        source: sourceKey,
        mtimeMs: 0,
        etag,
        records
      };

      return records;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Users table cannot be loaded.");
}

async function studentExists(fullName, groupNumber) {
  const normalizedFullName = normalizeFullName(fullName);
  const normalizedGroupNumber = normalizeGroupNumber(groupNumber);
  if (!normalizedFullName || !normalizedGroupNumber) {
    return false;
  }

  const records = await loadRecords();
  return records.some(
    (record) =>
      record.fullName === normalizedFullName &&
      record.groupNumber === normalizedGroupNumber
  );
}

module.exports = {
  studentExists
};
