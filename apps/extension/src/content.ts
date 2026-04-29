declare const chrome: any;

type FillPayload = {
  command: "analyze" | "fill";
  apiBaseUrl: string;
  sessionId: string;
  target?: {
    sessionId: string;
    job: {
      id: string;
      url: string;
      atsType: string;
    };
    profile: {
      fullName: string;
      preferredName: string;
      email: string;
      phone: string;
      location: string;
      linkedinUrl: string;
      portfolioUrl: string;
      githubUrl: string;
      summary: string;
      documents: {
        resumeFileName: string;
        coverLetterFileName: string;
      };
      screeningAnswers: Record<string, string>;
      experiences: Array<{ company: string; title: string }>;
      education: Array<{ school: string; degree: string }>;
    };
  };
};

type CandidateProfilePayload = NonNullable<FillPayload["target"]>["profile"];

type CollectedField = {
  id: string;
  label: string;
  key: string;
  type: string;
  required: boolean;
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
};

chrome.runtime.onMessage.addListener((payload: FillPayload, _sender: unknown, sendResponse: (value: unknown) => void) => {
  void handleMessage(payload).then(sendResponse);
  return true;
});

async function handleMessage(payload: FillPayload) {
  if (payload.command === "analyze") {
    const fields = collectFields();
    return {
      atsType: detectAts(window.location.href),
      url: window.location.href,
      fieldCount: fields.length,
      fields: fields.slice(0, 12).map(({ element, ...field }) => field),
    };
  }

  if (!payload.target) {
    return { ok: false, message: "No execution target found." };
  }

  const atsType = detectAts(window.location.href);
  if (atsType === "unsupported") {
    await reportEvent(payload, "error", "Unsupported ATS page detected.", "paused", "Unsupported page");
    return { ok: false, message: "Unsupported ATS page." };
  }

  const fields = collectFields();
  let filled = 0;
  let manual = 0;

  await reportEvent(payload, "info", `Detected ${atsType} page with ${fields.length} candidate fields.`, "running");

  for (const field of fields) {
    const mapped = resolveValue(field, payload.target.profile);
    if (mapped.status === "filled") {
      const result = applyValue(field.element, mapped.value);
      if (result) {
        filled += 1;
      } else {
        manual += 1;
      }
    } else {
      manual += 1;
    }
  }

  const blockers = detectBlockers();
  if (blockers.length > 0) {
    await reportEvent(payload, "warning", `Paused for manual action: ${blockers.join(", ")}.`, "paused", blockers.join(", "));
    return { ok: true, filled, manual, blockers };
  }

  await reportEvent(payload, "info", `Autofill finished. ${filled} fields filled, ${manual} left for review.`, "completed");
  return { ok: true, filled, manual, atsType };
}

function collectFields() {
  return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"))
    .filter((element) => !["hidden", "submit"].includes((element as HTMLInputElement).type))
    .map<CollectedField>((element, index) => ({
      id: element.id || element.getAttribute("name") || `field_${index}`,
      label: resolveLabel(element),
      key: inferKey(`${resolveLabel(element)} ${element.getAttribute("name") ?? ""}`),
      type: resolveType(element),
      required: element.required || element.getAttribute("aria-required") === "true",
      element,
    }));
}

function resolveLabel(element: Element): string {
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  const wrapper = element.closest("label");
  if (wrapper?.textContent?.trim()) return wrapper.textContent.trim();

  return element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.getAttribute("name") || "Unknown field";
}

function resolveType(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element instanceof HTMLSelectElement) return "select";
  if (element.type === "checkbox") return "checkbox";
  if (element.type === "radio") return "radio";
  if (element.type === "file") return "file";
  return "text";
}

function inferKey(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("first")) return "firstName";
  if (normalized.includes("last")) return "lastName";
  if (normalized.includes("full name") || normalized === "name") return "fullName";
  if (normalized.includes("email")) return "email";
  if (normalized.includes("phone") || normalized.includes("mobile")) return "phone";
  if (normalized.includes("linkedin")) return "linkedinUrl";
  if (normalized.includes("portfolio") || normalized.includes("website")) return "portfolioUrl";
  if (normalized.includes("github")) return "githubUrl";
  if (normalized.includes("location") || normalized.includes("address")) return "location";
  if (normalized.includes("resume") || normalized.includes("cv")) return "resume";
  if (normalized.includes("cover")) return "coverLetter";
  if (normalized.includes("authorized") || normalized.includes("eligible")) return "eligibleToWork";
  if (normalized.includes("sponsorship") || normalized.includes("visa")) return "requiresVisaSponsorship";
  if (normalized.includes("relocate")) return "willingToRelocate";
  if (normalized.includes("summary")) return "summary";
  return "unknown";
}

function resolveValue(field: CollectedField, profile: CandidateProfilePayload) {
  const [firstName, ...restNames] = profile.fullName.split(" ");
  const lastName = restNames.join(" ");
  const currentExperience = profile.experiences[0];
  const answers: Record<string, string | undefined> = {
    fullName: profile.fullName,
    firstName,
    lastName,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    linkedinUrl: profile.linkedinUrl,
    portfolioUrl: profile.portfolioUrl,
    githubUrl: profile.githubUrl,
    resume: profile.documents.resumeFileName,
    coverLetter: profile.documents.coverLetterFileName,
    eligibleToWork: profile.screeningAnswers.eligibleToWork,
    requiresVisaSponsorship: profile.screeningAnswers.requiresVisaSponsorship,
    willingToRelocate: profile.screeningAnswers.willingToRelocate,
    summary: profile.summary,
    currentCompany: currentExperience?.company,
    currentTitle: currentExperience?.title,
  };

  const value = answers[field.key];
  if (!value) {
    return { status: "manual_required" as const };
  }

  return { status: "filled" as const, value };
}

function applyValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  if (element instanceof HTMLInputElement && element.type === "file") {
    return false;
  }

  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    element.checked = value.toLowerCase() === "yes";
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (element instanceof HTMLInputElement && element.type === "radio") {
    const name = element.getAttribute("name");
    if (!name) return false;
    const radios = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`));
    const match = radios.find((radio) => {
      const label = resolveLabel(radio).toLowerCase();
      return label.includes(value.toLowerCase()) || (radio.value && radio.value.toLowerCase() === value.toLowerCase());
    });
    if (!match) return false;
    match.click();
    return true;
  }

  if (element instanceof HTMLSelectElement) {
    const match = Array.from(element.options).find(
      (option) =>
        option.value.toLowerCase() === value.toLowerCase() || option.textContent?.trim().toLowerCase() === value.toLowerCase(),
    );
    if (!match) return false;
    element.value = match.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function detectAts(url: string) {
  if (/greenhouse\.io/i.test(url)) return "greenhouse";
  if (/jobs\.lever\.co|lever\.co/i.test(url)) return "lever";
  if (/workdayjobs\.com|myworkdayjobs\.com/i.test(url)) return "workday";
  return "unsupported";
}

function detectBlockers() {
  const text = document.body.innerText.toLowerCase();
  const blockers: string[] = [];
  if (text.includes("captcha")) blockers.push("captcha");
  if (text.includes("multi-factor") || text.includes("verification code")) blockers.push("mfa");
  return blockers;
}

async function reportEvent(
  payload: FillPayload,
  level: "info" | "warning" | "error",
  message: string,
  status: "running" | "paused" | "completed",
  pauseReason?: string,
) {
  if (!payload.target) return;

  await fetch(`${payload.apiBaseUrl}/api/execution/${payload.sessionId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: payload.target.job.id,
      status,
      pauseReason,
      event: {
        timestamp: new Date().toISOString(),
        level,
        message,
      },
    }),
  });
}
