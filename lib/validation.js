const BAD_WORD_PATTERNS = [
  /хуй/u,
  /хуе/u,
  /пизд/u,
  /еба/u,
  /ёба/u,
  /бля/u,
  /муд[ао]/u,
  /гандон/u,
  /шлюх/u,
  /сук[аи]/u
];

function normalizeSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeFullName(value) {
  return normalizeSpaces(value)
    .replace(/[^А-Яа-яЁё\s]/g, " ")
    .replace(/ё/gi, "е")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeGroupNumber(value) {
  return normalizeSpaces(value)
    .replace(/\s*-\s*/g, "-")
    .replace(/ё/gi, "е")
    .toUpperCase();
}

function containsRussianProfanity(value) {
  const normalized = normalizeSpaces(value).toLowerCase().replace(/ё/g, "е");
  return BAD_WORD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function validateRegistration(payload) {
  const fullName = normalizeSpaces(payload.fullName);
  const groupNumber = normalizeGroupNumber(payload.groupNumber);
  const crId = String(payload.crId || "").trim().toUpperCase();
  const crNickname = normalizeSpaces(payload.crNickname);
  const errors = {};

  if (fullName.length <= 5) {
    errors.fullName = "ФИО должно быть длиннее 5 символов.";
  } else if (!/^[А-Яа-яЁё]+(?: [А-Яа-яЁё]+)+$/.test(fullName)) {
    errors.fullName = "ФИО: только русские буквы и минимум 2 слова.";
  }

  if (groupNumber.length <= 3) {
    errors.groupNumber = "Номер группы должен быть длиннее 3 символов.";
  } else if ((groupNumber.match(/-/g) || []).length !== 1) {
    errors.groupNumber = "В номере группы должно быть ровно одно тире.";
  } else if (/[A-Za-z]/.test(groupNumber)) {
    errors.groupNumber = "В номере группы не должно быть английских букв.";
  } else if (!/^[А-Яа-яЁё0-9-]+$/.test(groupNumber)) {
    errors.groupNumber = "Номер группы содержит недопустимые символы.";
  }

  if (crId.length <= 3) {
    errors.crId = "CR тэг должен быть длиннее 3 символов.";
  } else if (!crId.startsWith("#")) {
    errors.crId = "CR тэг должен начинаться с #.";
  } else if (/[А-Яа-яЁё]/.test(crId)) {
    errors.crId = "CR тэг не должен содержать русские буквы.";
  } else if (!/^#[A-Z0-9]+$/.test(crId)) {
    errors.crId = "CR тэг может содержать только #, латиницу и цифры.";
  }

  if (!crNickname) {
    errors.crNickname = "CR nickname обязателен.";
  } else if (containsRussianProfanity(crNickname)) {
    errors.crNickname = "CR nickname содержит запрещенные выражения.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      fullName,
      groupNumber,
      crId,
      crNickname
    }
  };
}

module.exports = {
  containsRussianProfanity,
  normalizeFullName,
  normalizeGroupNumber,
  normalizeSpaces,
  validateRegistration
};
