type CurrentTargetResponse = {
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

const apiInput = document.querySelector<HTMLInputElement>("#apiBaseUrl");
const sessionInput = document.querySelector<HTMLInputElement>("#sessionId");
const analyzeButton = document.querySelector<HTMLButtonElement>("#analyzeButton");
const fillButton = document.querySelector<HTMLButtonElement>("#fillButton");
const statusNode = document.querySelector<HTMLElement>("#status");

bootstrap();

function bootstrap() {
  chrome.storage.local.get(["apiBaseUrl", "sessionId"], (stored: { apiBaseUrl?: string; sessionId?: string }) => {
    if (apiInput && stored.apiBaseUrl) apiInput.value = stored.apiBaseUrl;
    if (sessionInput && stored.sessionId) sessionInput.value = stored.sessionId;
  });

  analyzeButton?.addEventListener("click", () => {
    void sendCommand("analyze");
  });

  fillButton?.addEventListener("click", () => {
    void sendCommand("fill");
  });
}

async function sendCommand(command: "analyze" | "fill") {
  if (!apiInput || !sessionInput || !statusNode) return;

  const apiBaseUrl = apiInput.value.trim();
  const sessionId = sessionInput.value.trim();
  chrome.storage.local.set({ apiBaseUrl, sessionId });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusNode.textContent = "No active tab available.";
    return;
  }

  if (command === "fill" && !sessionId) {
    statusNode.textContent = "Add a session ID before autofill.";
    return;
  }

  let target: CurrentTargetResponse | undefined;
  if (command === "fill") {
    const response = await fetch(`${apiBaseUrl}/api/execution/${sessionId}/current`);
    if (!response.ok) {
      statusNode.textContent = "Could not fetch queued job from the web app.";
      return;
    }
    target = (await response.json()) as CurrentTargetResponse;
  }

  const result = await chrome.tabs.sendMessage(tab.id, {
    command,
    apiBaseUrl,
    sessionId,
    target,
  });

  statusNode.textContent = JSON.stringify(result, null, 2);
}
