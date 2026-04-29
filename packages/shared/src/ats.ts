import type {
  AtsAdapter,
  AtsType,
  CandidateProfile,
  CanonicalFieldKey,
  FieldDescriptor,
  FieldResolution,
  FieldType,
} from "./types";

const greenhouseFields: FieldDescriptor[] = [
  makeTemplateField("first_name", "firstName", "First Name", "text", true),
  makeTemplateField("last_name", "lastName", "Last Name", "text", true),
  makeTemplateField("email", "email", "Email", "email", true),
  makeTemplateField("phone", "phone", "Phone", "tel", false),
  makeTemplateField("location", "location", "Location", "text", false),
  makeTemplateField("resume", "resume", "Resume", "file", true),
  makeTemplateField("linkedin", "linkedinUrl", "LinkedIn", "url", false),
  makeTemplateField("portfolio", "portfolioUrl", "Portfolio", "url", false),
  makeTemplateField("work_auth", "eligibleToWork", "Eligible to work", "radio", true, ["Yes", "No"]),
  makeTemplateField("sponsorship", "requiresVisaSponsorship", "Requires sponsorship", "radio", true, ["Yes", "No"]),
];

const leverFields: FieldDescriptor[] = [
  makeTemplateField("name", "fullName", "Full name", "text", true),
  makeTemplateField("email", "email", "Email", "email", true),
  makeTemplateField("phone", "phone", "Phone", "tel", false),
  makeTemplateField("location", "location", "Location", "text", false),
  makeTemplateField("resume", "resume", "Resume", "file", true),
  makeTemplateField("linkedin", "linkedinUrl", "LinkedIn", "url", false),
  makeTemplateField("github", "githubUrl", "GitHub", "url", false),
  makeTemplateField("portfolio", "portfolioUrl", "Portfolio", "url", false),
  makeTemplateField("sponsorship", "requiresVisaSponsorship", "Requires sponsorship", "radio", true, ["Yes", "No"]),
];

const workdayFields: FieldDescriptor[] = [
  makeTemplateField("first_name", "firstName", "First Name", "text", true),
  makeTemplateField("last_name", "lastName", "Last Name", "text", true),
  makeTemplateField("email", "email", "Email", "email", true),
  makeTemplateField("phone", "phone", "Phone", "tel", true),
  makeTemplateField("address", "location", "Address / Location", "text", true),
  makeTemplateField("resume", "resume", "Resume", "file", true),
  makeTemplateField("linkedin", "linkedinUrl", "LinkedIn Profile", "url", false),
  makeTemplateField("work_auth", "eligibleToWork", "Authorized to work", "radio", true, ["Yes", "No"]),
  makeTemplateField("sponsorship", "requiresVisaSponsorship", "Need sponsorship", "radio", true, ["Yes", "No"]),
  makeTemplateField("relocate", "willingToRelocate", "Willing to relocate", "radio", false, ["Yes", "No"]),
];

function makeTemplateField(
  id: string,
  key: CanonicalFieldKey,
  label: string,
  type: FieldType,
  required: boolean,
  options?: string[],
): FieldDescriptor {
  return {
    id,
    key,
    label,
    type,
    required,
    options,
    source: "template",
    confidence: 0.8,
  };
}

export const atsAdapters: AtsAdapter[] = [
  {
    type: "greenhouse",
    detect: (url) => /greenhouse\.io/i.test(url),
    getStandardFields: () => greenhouseFields,
  },
  {
    type: "lever",
    detect: (url) => /jobs\.lever\.co|lever\.co/i.test(url),
    getStandardFields: () => leverFields,
  },
  {
    type: "workday",
    detect: (url) => /workdayjobs\.com|myworkdayjobs\.com/i.test(url),
    getStandardFields: () => workdayFields,
  },
];

export function detectAtsType(url: string): AtsType {
  const match = atsAdapters.find((adapter) => adapter.detect(url));
  return match?.type ?? "unsupported";
}

export function getStandardFieldsForAts(atsType: AtsType): FieldDescriptor[] {
  return atsAdapters.find((adapter) => adapter.type === atsType)?.getStandardFields() ?? [];
}

export function inferCanonicalFieldKey(input: string): CanonicalFieldKey {
  const normalized = input.trim().toLowerCase();

  if (normalized.includes("first")) return "firstName";
  if (normalized.includes("last")) return "lastName";
  if (normalized.includes("full name") || normalized === "name") return "fullName";
  if (normalized.includes("preferred")) return "preferredName";
  if (normalized.includes("email")) return "email";
  if (normalized.includes("phone") || normalized.includes("mobile")) return "phone";
  if (normalized.includes("location") || normalized.includes("address") || normalized.includes("city")) return "location";
  if (normalized.includes("linkedin")) return "linkedinUrl";
  if (normalized.includes("portfolio") || normalized.includes("website")) return "portfolioUrl";
  if (normalized.includes("github")) return "githubUrl";
  if (normalized.includes("resume") || normalized.includes("cv")) return "resume";
  if (normalized.includes("cover")) return "coverLetter";
  if (normalized.includes("summary")) return "summary";
  if (normalized.includes("authorized") || normalized.includes("eligible")) return "eligibleToWork";
  if (normalized.includes("sponsorship") || normalized.includes("visa")) return "requiresVisaSponsorship";
  if (normalized.includes("relocate")) return "willingToRelocate";
  if (normalized.includes("company")) return "currentCompany";
  if (normalized.includes("title")) return "currentTitle";
  if (normalized.includes("education")) return "education";

  return "unknown";
}

export function extractFieldsFromDocument(doc: Document): FieldDescriptor[] {
  const elements = Array.from(doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));

  return elements
    .filter((element) => !["hidden", "submit"].includes((element as HTMLInputElement).type))
    .map((element, index) => {
      const id = element.id || element.getAttribute("name") || `field_${index}`;
      const label = resolveLabel(doc, element);
      const key = inferCanonicalFieldKey(`${label} ${element.getAttribute("name") ?? ""}`);
      const type = resolveFieldType(element);
      const options =
        element instanceof HTMLSelectElement
          ? Array.from(element.options).map((option) => option.textContent?.trim() ?? "").filter(Boolean)
          : undefined;

      return {
        id,
        key,
        label,
        type,
        required: element.required || element.getAttribute("aria-required") === "true",
        options,
        source: "dom" as const,
        selector: buildSelector(element),
        confidence: key === "unknown" ? 0.3 : 0.7,
      };
    });
}

function resolveLabel(doc: Document, element: Element): string {
  const htmlFor = element.getAttribute("id");
  if (htmlFor) {
    const label = doc.querySelector(`label[for="${htmlFor}"]`);
    if (label?.textContent?.trim()) {
      return label.textContent.trim();
    }
  }

  const wrapperLabel = element.closest("label");
  if (wrapperLabel?.textContent?.trim()) {
    return wrapperLabel.textContent.trim();
  }

  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("placeholder") ||
    element.getAttribute("name") ||
    "Unknown field"
  );
}

function resolveFieldType(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldType {
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLInputElement) {
    if (element.type === "email") return "email";
    if (element.type === "tel") return "tel";
    if (element.type === "url") return "url";
    if (element.type === "radio") return "radio";
    if (element.type === "checkbox") return "checkbox";
    if (element.type === "date") return "date";
    if (element.type === "file") return "file";
  }

  return "text";
}

function buildSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  if (element.getAttribute("name")) return `${element.tagName.toLowerCase()}[name="${element.getAttribute("name")}"]`;
  return element.tagName.toLowerCase();
}

export function resolveFieldValue(field: FieldDescriptor, profile: CandidateProfile): FieldResolution {
  const [firstName, ...restNames] = profile.fullName.split(" ");
  const lastName = restNames.join(" ");
  const currentExperience = profile.experiences[0];

  const lookup: Record<CanonicalFieldKey, string | boolean | undefined> = {
    fullName: profile.fullName,
    firstName,
    lastName,
    preferredName: profile.preferredName,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    linkedinUrl: profile.linkedinUrl,
    portfolioUrl: profile.portfolioUrl,
    githubUrl: profile.githubUrl,
    resume: profile.documents.resumeFileName,
    coverLetter: profile.documents.coverLetterFileName,
    summary: profile.summary,
    eligibleToWork: profile.screeningAnswers.eligibleToWork ?? (profile.workAuthorization.authorized ? "Yes" : "No"),
    requiresVisaSponsorship:
      profile.screeningAnswers.requiresVisaSponsorship ?? (profile.workAuthorization.requiresSponsorship ? "Yes" : "No"),
    willingToRelocate: profile.screeningAnswers.willingToRelocate,
    currentCompany: currentExperience?.company,
    currentTitle: currentExperience?.title,
    education: profile.education[0] ? `${profile.education[0].degree} - ${profile.education[0].school}` : undefined,
    unknown: undefined,
  };

  const value = lookup[field.key];
  if (field.key === "unknown") {
    return {
      fieldId: field.id,
      key: field.key,
      label: field.label,
      status: "manual_required",
      reason: "Unsupported custom field",
      confidence: field.confidence,
    };
  }

  if (value === undefined || value === "") {
    return {
      fieldId: field.id,
      key: field.key,
      label: field.label,
      status: field.required ? "missing" : "manual_required",
      reason: field.required ? "Missing required candidate data" : "Optional field left for user review",
      confidence: field.confidence,
    };
  }

  return {
    fieldId: field.id,
    key: field.key,
    label: field.label,
    status: "filled",
    value,
    confidence: field.confidence,
  };
}

export function buildFieldResolutions(fields: FieldDescriptor[], profile: CandidateProfile): FieldResolution[] {
  return fields.map((field) => resolveFieldValue(field, profile));
}
