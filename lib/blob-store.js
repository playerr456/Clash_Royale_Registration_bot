const { get, list, put } = require("@vercel/blob");

const REGISTRATIONS_ROOT = String(process.env.REGISTRATIONS_ROOT || "registrations")
  .replace(/^\/+/, "")
  .replace(/\/+$/, "");

function normalizeTgId(tgId) {
  return String(tgId || "").trim();
}

function registrationPrefixFor(tgId) {
  return `${REGISTRATIONS_ROOT}/${tgId}/`;
}

function getBlobAccessCandidates() {
  const envAccess = String(process.env.BLOB_ACCESS || "").toLowerCase();
  if (envAccess === "public") {
    return ["public", "private"];
  }
  if (envAccess === "private") {
    return ["private", "public"];
  }
  return ["public", "private"];
}

async function listAllBlobs(prefix) {
  const blobs = [];
  let cursor;

  do {
    const response = await list({
      prefix,
      limit: 1000,
      cursor
    });
    blobs.push(...response.blobs);
    cursor = response.hasMore ? response.cursor : undefined;
  } while (cursor);

  return blobs;
}

function extractTimestampFromPathname(pathname) {
  const match = String(pathname || "").match(/\/(\d+)\.txt$/);
  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

function pickLatestBlob(blobs) {
  if (!Array.isArray(blobs) || blobs.length === 0) {
    return null;
  }

  return blobs.reduce((latest, current) => {
    const latestTimestamp = extractTimestampFromPathname(latest.pathname);
    const currentTimestamp = extractTimestampFromPathname(current.pathname);

    if (currentTimestamp > latestTimestamp) {
      return current;
    }

    if (currentTimestamp < latestTimestamp) {
      return latest;
    }

    const latestUploadedAt = latest.uploadedAt instanceof Date
      ? latest.uploadedAt.getTime()
      : new Date(latest.uploadedAt || 0).getTime();
    const currentUploadedAt = current.uploadedAt instanceof Date
      ? current.uploadedAt.getTime()
      : new Date(current.uploadedAt || 0).getTime();
    return currentUploadedAt > latestUploadedAt ? current : latest;
  });
}

async function getBlobText(pathname) {
  const accessCandidates = getBlobAccessCandidates();
  let lastError = null;

  for (const access of accessCandidates) {
    try {
      const blob = await get(pathname, { access });
      if (!blob || blob.statusCode !== 200 || !blob.stream) {
        continue;
      }

      const reader = blob.stream.getReader();
      const decoder = new TextDecoder("utf-8");
      let text = "";

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      return text;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

function parseRegistrationText(content) {
  const result = {};
  const lines = String(content || "").split(/\r?\n/);

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value) {
      continue;
    }

    if (key === "фио") {
      result.fullName = value;
      continue;
    }
    if (key === "номер группы") {
      result.groupNumber = value;
      continue;
    }
    if (key === "cr id" || key === "cr тэг" || key === "cr тег") {
      result.crId = value;
      continue;
    }
    if (key === "cr nickname") {
      result.crNickname = value;
      continue;
    }
  }

  if (!result.fullName || !result.groupNumber || !result.crId || !result.crNickname) {
    return null;
  }

  return result;
}

async function hasRegistrationFolder(tgId) {
  const normalized = normalizeTgId(tgId);
  if (!normalized) {
    return false;
  }

  const prefixes = [registrationPrefixFor(normalized), `${normalized}/`];
  for (const prefix of prefixes) {
    const response = await list({
      prefix,
      limit: 1
    });
    if (response.blobs.length > 0) {
      return true;
    }
  }

  return false;
}

async function getLatestRegistration(tgId) {
  const normalized = normalizeTgId(tgId);
  if (!normalized) {
    return null;
  }

  const prefixes = [registrationPrefixFor(normalized), `${normalized}/`];
  for (const prefix of prefixes) {
    const blobs = await listAllBlobs(prefix);
    if (blobs.length === 0) {
      continue;
    }

    const latestBlob = pickLatestBlob(blobs);
    if (!latestBlob) {
      continue;
    }

    const text = await getBlobText(latestBlob.pathname);
    if (!text) {
      continue;
    }

    const parsed = parseRegistrationText(text);
    if (!parsed) {
      continue;
    }

    return {
      ...parsed,
      timestamp: extractTimestampFromPathname(latestBlob.pathname)
    };
  }

  return null;
}

async function saveRegistrationFile(tgId, timestampMs, content) {
  const normalized = normalizeTgId(tgId);
  const key = `${registrationPrefixFor(normalized)}${timestampMs}.txt`;
  const envAccess = String(process.env.BLOB_ACCESS || "").toLowerCase();
  const explicitAccess = envAccess === "public" || envAccess === "private" ? envAccess : "";
  const attemptAccessValues = explicitAccess
    ? [explicitAccess, explicitAccess === "public" ? "private" : "public", null]
    : ["public", "private", null];

  const putWithAccess = (access) => {
    const options = {
      addRandomSuffix: false,
      contentType: "text/plain; charset=utf-8"
    };
    if (access) {
      options.access = access;
    }
    return put(key, content, options);
  };

  let lastError = null;
  for (let index = 0; index < attemptAccessValues.length; index += 1) {
    const access = attemptAccessValues[index];
    try {
      return await putWithAccess(access);
    } catch (error) {
      lastError = error;
      const hasNext = index < attemptAccessValues.length - 1;
      if (!hasNext) {
        throw error;
      }
    }
  }

  throw lastError;
}

module.exports = {
  hasRegistrationFolder,
  getLatestRegistration,
  saveRegistrationFile
};
