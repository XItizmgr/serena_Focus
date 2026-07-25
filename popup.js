const default_sites = ["youtube.com", "instagram.com", "facebook.com"];

let timerInterval = null;
let remainingSeconds = 25 * 60;
let isRunning = false;


const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const resetBtn = document.getElementById("resetBtn");
const timerDisplay = document.getElementById("timer");
const statusDisplay = document.getElementById("status");
const customMinutesInput = document.getElementById("customMinutes");

const inputForsite = document.getElementById("site");
const addbtn = document.getElementById("addbtn");
const siteList = document.getElementById("siteList");
const siteCount = document.getElementById("siteCount");


document.addEventListener("DOMContentLoaded", () => {

  chrome.storage.local.get(["remainingSeconds", "isRunning", "endTime", "blockedDomains"], (data) => {
    let domains = data.blockedDomains || default_sites;
    if (!data.blockedDomains) {
      chrome.storage.local.set({ blockedDomains: domains });
    }
    renderlist(domains);

    if (data.isRunning && data.endTime) {

      const now = Date.now();
      const remaining = Math.max(0, Math.floor((data.endTime - now) / 1000));
      if (remaining > 0) {
        remainingSeconds = remaining;
        startTimer();
      } else {
        resetTimer();
      }
    } else if (data.remainingSeconds) {

      remainingSeconds = data.remainingSeconds;
      updateDisplay();
    }
  });
});


playPauseBtn.addEventListener("click", () => {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener("click", () => {
  resetTimer();
});

customMinutesInput.addEventListener("change", () => {
  if (!isRunning) {
    const mins = Math.max(1, parseInt(customMinutesInput.value) || 25);
    remainingSeconds = mins * 60;
    updateDisplay();
  }
});

function startTimer() {
  isRunning = true;
  playIcon.textContent = "❚❚";
  statusDisplay.textContent = "Status: Focusing ";
  customMinutesInput.disabled = true;

  const endTime = Date.now() + remainingSeconds * 1000;
  chrome.storage.local.set({ isRunning: true, endTime });


  chrome.storage.local.get(["blockedDomains"], (data) => {
    updateBlockingRules(data.blockedDomains || default_sites, true);
  });

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remainingSeconds = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    updateDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      alert("Focus Session Finished!");
      resetTimer();
    }
  }, 1000);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  playIcon.textContent = "▶";
  statusDisplay.textContent = "Status: Paused ⏸";


  updateBlockingRules([], false);
  chrome.storage.local.set({ isRunning: false, remainingSeconds, endTime: null });
}

function resetTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  playIcon.textContent = "▶";
  statusDisplay.textContent = "Status: Idle";
  customMinutesInput.disabled = false;

  const mins = Math.max(1, parseInt(customMinutesInput.value) || 25);
  remainingSeconds = mins * 60;
  updateDisplay();

  updateBlockingRules([], false);
  chrome.storage.local.set({ isRunning: false, remainingSeconds, endTime: null });
}

function updateDisplay() {
  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const secs = String(remainingSeconds % 60).padStart(2, "0");
  timerDisplay.textContent = `${mins}:${secs}`;
}

function getfaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function renderlist(domains) {
  if (!siteList) return;
  siteList.innerHTML = "";
  if (siteCount) siteCount.textContent = `${domains.length} SITES`;

  domains.forEach((domain) => {
    const li = document.createElement("li");
    li.className = "site-item";
    li.innerHTML = `
      <div class="site-info">
        <img class="site-icon" src="${getfaviconUrl(domain)}" alt="icon" onerror="this.src='https://google.com/favicon.ico'" />
        <span>${domain}</span>
      </div>
      <button class="delete-btn" data-domain="${domain}">✕</button>
    `;
    li.querySelector(".delete-btn").addEventListener("click", (e) => {
      const targetDomain = e.target.getAttribute("data-domain");
      removeDomain(targetDomain);
    });
    siteList.appendChild(li);
  });
}

addbtn.addEventListener("click", () => {
  let domain = inputForsite.value.trim().toLowerCase();
  domain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0];
  if (!domain) return;

  chrome.storage.local.get(["blockedDomains"], (data) => {
    const currentDomains = data.blockedDomains || default_sites;
    if (!currentDomains.includes(domain)) {
      const updatedDomains = [...currentDomains, domain];
      chrome.storage.local.set({ blockedDomains: updatedDomains }, () => {
        renderlist(updatedDomains);
        inputForsite.value = "";
        if (isRunning) {
          updateBlockingRules(updatedDomains, true);
        }
      });
    }
  });
});

function removeDomain(domainToRemove) {
  chrome.storage.local.get(["blockedDomains"], (data) => {
    const currentDomains = data.blockedDomains || [];
    const updatedDomains = currentDomains.filter((d) => d !== domainToRemove);

    chrome.storage.local.set({ blockedDomains: updatedDomains }, () => {
      renderlist(updatedDomains);
      if (isRunning) {
        updateBlockingRules(updatedDomains, true);
      }
    });
  });
}

function updateBlockingRules(domains, shouldBlock) {
  const rules = shouldBlock
    ? domains.map((domain, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: "block" },
        condition: { urlFilter: `||${domain}^`, resourceTypes: ["main_frame"] },
      }))
    : [];

  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const existingIds = existingRules.map((r) => r.id);
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules,
    });
  });
}