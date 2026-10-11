(function () {
  const config = window.MarquisBookingConfig || {};
  const form = document.getElementById("booking-form");
  const status = document.getElementById("booking-status");
  const submitButton = document.getElementById("booking-submit");

  if (!form || !status || !submitButton) {
    return;
  }

  const rememberedNameCookie = "marquis_booking_name";
  const nameField = form.elements.name;
  const rememberNameField = form.elements.rememberName;

  function readRememberedName() {
    const cookie = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(rememberedNameCookie + "="));

    if (!cookie) {
      return "";
    }

    try {
      return decodeURIComponent(cookie.slice(rememberedNameCookie.length + 1));
    } catch {
      return "";
    }
  }

  function clearRememberedName() {
    document.cookie = rememberedNameCookie + "=; Max-Age=0; Path=/; SameSite=Lax; Secure";
  }

  function saveRememberedName(name) {
    const value = String(name || "").trim();
    if (!value) {
      clearRememberedName();
      return;
    }

    const maxAge = 180 * 24 * 60 * 60;
    document.cookie =
      rememberedNameCookie +
      "=" +
      encodeURIComponent(value) +
      "; Max-Age=" +
      maxAge +
      "; Path=/; SameSite=Lax; Secure";
  }

  const savedName = readRememberedName();
  if (savedName && nameField && rememberNameField) {
    nameField.value = savedName;
    rememberNameField.checked = true;
  }

  if (rememberNameField) {
    rememberNameField.addEventListener("change", function () {
      if (!rememberNameField.checked) {
        clearRememberedName();
      }
    });
  }

  const requestedService = new URLSearchParams(window.location.search).get("service");
  if (requestedService) {
    const serviceField = form.elements.service;
    const serviceOption = Array.from(serviceField.options).find(
      (option) => option.textContent === requestedService
    );
    if (serviceOption) {
      serviceField.value = serviceOption.value;
    }
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "status" + (kind ? " " + kind : "");
  }

  function toIsoUtc(localValue) {
    return new Date(localValue).toISOString();
  }

  function addMinutes(localValue, minutes) {
    const date = new Date(localValue);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  }

  function createFallbackIcs(payload) {
    const start = payload.start.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const end = payload.end.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Marquis SPA//Booking Request//EN",
      "BEGIN:VEVENT",
      "UID:" + crypto.randomUUID() + "@marquis.spa",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"),
      "DTSTART:" + start,
      "DTEND:" + end,
      "SUMMARY:" + payload.service + " - " + payload.name,
      "DESCRIPTION:" + [
        "Requester: " + payload.name,
        "Email: " + payload.email,
        "Phone: " + (payload.phone || ""),
        "Notes: " + (payload.notes || ""),
      ].join("\\n"),
      "LOCATION:" + (payload.location || "Marquis day SPA"),
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return lines.join("\r\n");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const startValue = formData.get("start");
    const duration = Number(formData.get("duration"));

    if (!startValue || Number.isNaN(duration) || duration <= 0) {
      setStatus("Choose a valid start time and duration.", "error");
      return;
    }

    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      service: String(formData.get("service") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      start: toIsoUtc(startValue),
      end: addMinutes(startValue, duration),
      timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      location: config.location || "Marquis day SPA",
    };

    submitButton.disabled = true;
    setStatus("Submitting booking request...", "");

    try {
      if (!config.bookingEndpoint) {
        const ics = createFallbackIcs(payload);
        const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "marquis-booking-request.ics";
        link.click();
        URL.revokeObjectURL(url);
        if (rememberNameField && rememberNameField.checked) {
          saveRememberedName(payload.name);
        }
        setStatus(
          "Booking bridge is not configured yet. I downloaded an ICS request you can import manually.",
          "error"
        );
        return;
      }

      const response = await fetch(config.bookingEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "The booking bridge could not create the event.");
      }

      const shouldRememberName = Boolean(rememberNameField && rememberNameField.checked);
      if (shouldRememberName) {
        saveRememberedName(payload.name);
      } else {
        clearRememberedName();
      }

      form.reset();
      if (shouldRememberName && rememberNameField) {
        nameField.value = payload.name;
        rememberNameField.checked = true;
      }
      setStatus(config.successMessage || "Booking submitted successfully.", "ok");
    } catch (error) {
      setStatus(error.message || "Something went wrong while submitting your booking.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
})();
