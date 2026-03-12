const profanityPatterns = [
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

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
const params = new URLSearchParams(window.location.search);
let mode = params.get("mode") === "edit" ? "edit" : "new";
let hasExistingRegistration = false;
let editOnlyView = false;
let existingRegistration = null;

const form = document.getElementById("registration-form");
const formFields = Array.from(form.querySelectorAll(".field"));
const submitBtn = document.getElementById("submitBtn");
const switchToEditBtn = document.getElementById("switchToEditBtn");
const title = document.getElementById("title");
const statusNode = document.getElementById("status");
const fullNameInput = document.getElementById("fullName");
const groupNumberInput = document.getElementById("groupNumber");
const crIdInput = document.getElementById("crId");
const crNicknameInput = document.getElementById("crNickname");

function setRegistrationFormVisibility(visible) {
  formFields.forEach((field) => {
    field.classList.toggle("hidden", !visible);
  });
  submitBtn.classList.toggle("hidden", !visible);
}

function applyMode(nextMode) {
  mode = nextMode === "edit" ? "edit" : "new";

  if (!editOnlyView) {
    if (mode === "edit") {
      title.textContent = "Изменение регистрации";
      submitBtn.textContent = "Сохранить изменения";
    } else {
      title.textContent = "Регистрация";
      submitBtn.textContent = "Отправить регистрацию";
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url.toString());
}

function enableEditOnlyView() {
  editOnlyView = true;
  setRegistrationFormVisibility(false);
  title.textContent = "Вы уже зарегистрированы";
  if (switchToEditBtn) {
    switchToEditBtn.classList.remove("hidden");
  }
  setStatus("Нажмите «Изменить регистрацию».", "");
}

function disableEditOnlyView() {
  editOnlyView = false;
  setRegistrationFormVisibility(true);
  if (switchToEditBtn) {
    switchToEditBtn.classList.add("hidden");
  }
  applyMode(mode);
}

function fillFormWithRegistration(registration) {
  if (!registration) {
    return;
  }

  if (typeof registration.fullName === "string") {
    fullNameInput.value = registration.fullName;
  }
  if (typeof registration.groupNumber === "string") {
    groupNumberInput.value = registration.groupNumber;
  }
  if (typeof registration.crId === "string") {
    crIdInput.value = registration.crId;
  }
  if (typeof registration.crNickname === "string") {
    crNicknameInput.value = registration.crNickname;
  }
}

if (tg) {
  tg.ready();
  tg.expand();
}

applyMode(mode);

function normalizeSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeGroup(value) {
  return normalizeSpaces(value).replace(/\s*-\s*/g, "-");
}

function clearErrors() {
  document.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });
}

function setError(field, message) {
  const node = document.querySelector(`[data-error-for="${field}"]`);
  if (node) {
    node.textContent = message;
  }
}

function setStatus(message, kind) {
  statusNode.textContent = message;
  statusNode.className = `status ${kind || ""}`.trim();
}

function containsProfanity(value) {
  const normalized = normalizeSpaces(value).toLowerCase().replace(/ё/g, "е");
  return profanityPatterns.some((pattern) => pattern.test(normalized));
}

function validate(formData) {
  const errors = {};
  const fullName = normalizeSpaces(formData.fullName);
  const groupNumber = normalizeGroup(formData.groupNumber);
  const crId = String(formData.crId || "").trim().toUpperCase();
  const crNickname = normalizeSpaces(formData.crNickname);

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
  } else if (containsProfanity(crNickname)) {
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

async function submitRegistration(payload) {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({
    ok: false,
    error: "Сервер вернул некорректный ответ."
  }));

  return { response, data };
}

async function loadRegistrationStatus() {
  if (!tg || !tg.initData) {
    return;
  }

  try {
    const response = await fetch("/api/registration-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ initData: tg.initData })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !data.ok) {
      return;
    }

    hasExistingRegistration = Boolean(data.hasRegistration);
    if (hasExistingRegistration && data.registration) {
      existingRegistration = data.registration;
      fillFormWithRegistration(existingRegistration);
    }

    if (hasExistingRegistration && mode !== "edit") {
      enableEditOnlyView();
    }
  } catch (_error) {
    // Ignore status checks, the form still works.
  }
}

if (switchToEditBtn) {
  switchToEditBtn.addEventListener("click", () => {
    applyMode("edit");
    disableEditOnlyView();
    fillFormWithRegistration(existingRegistration);
    setStatus("Режим изменения включен.", "success");
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  setStatus("", "");

  if (editOnlyView) {
    setStatus("Нажмите «Изменить регистрацию».", "error");
    return;
  }

  if (!tg || !tg.initData) {
    setStatus("Откройте мини-приложение через Telegram.", "error");
    return;
  }

  const formData = {
    fullName: fullNameInput.value,
    groupNumber: groupNumberInput.value,
    crId: crIdInput.value,
    crNickname: crNicknameInput.value
  };

  const validation = validate(formData);
  if (!validation.ok) {
    Object.entries(validation.errors).forEach(([field, message]) => {
      setError(field, message);
    });
    setStatus("Исправьте ошибки в форме.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Сохраняем...";

  try {
    const { response, data } = await submitRegistration({
      initData: tg.initData,
      mode,
      ...validation.value
    });

    if (response.ok && data.ok) {
      setStatus("Регистрация сохранена.", "success");
      if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
      }
      setTimeout(() => tg.close(), 1200);
      return;
    }

    if (data.errors) {
      Object.entries(data.errors).forEach(([field, message]) => {
        setError(field, message);
      });
      setStatus("Исправьте ошибки в форме.", "error");
      return;
    }

    if (data.needChange) {
      hasExistingRegistration = true;
      applyMode("new");
      enableEditOnlyView();
      return;
    }

    setStatus(data.error || "Не удалось отправить регистрацию.", "error");
  } catch (_error) {
    setStatus("Ошибка сети. Попробуйте еще раз.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === "edit" ? "Сохранить изменения" : "Отправить регистрацию";
  }
});

if (mode === "edit") {
  disableEditOnlyView();
} else {
  setRegistrationFormVisibility(true);
}

loadRegistrationStatus();
