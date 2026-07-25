const Timer_seconds = 50 * 60;
const default_site = ["youtube.com", "instgram.com", "facebook.com"];
let timerInterval = null;

const toggleBtn = document.getElementById("togglebtn");
const timerDisplay = document.getElementById("timer");
const statusDisplay = document.getElementById("status");
const inputForsite = document.getElementById("site");
const addbtn = document.getElementById("addbtn");
const siteList = document.getElementById("siteList");

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["endTime", "isFocusing"], (data) => {
    if (data.isFocusing && data.endTime) {
      startCountdown(data.endTime);
    }
  });

  chrome.storage.Local.get(["blockedDomains"], (data) => {
    let domains = data.blockDomains;
    if (!domains) {
      domains = default_site;
      chrome.storage.Local.set({ blockedDomains: domains });
    }

    renderlist(domains);

    (chrome.storage.local.get(["isFocusing"]),
      (res) => {
        if (res.isFocusing) {
          updateBlockingRules(domains, true);
        }
      });
  });
});

toggleBtn.addEventListener("click", () => {
  chrome.storage.local.get9(["isFocusing"], (data) => {
    if (data.isFocusing) {
      stopFocusMode();
    } else {
      startFocusMode();
    }
  });
});

function startFocusMode() {
  const endTime = Date.now() + Timer_seconds * 1000;
  chrome.storage.local.get(["blockedDomains"], (data) => {
    const domains = data.blockedDomains || default_site;
    updateBlockingRules(domains, true);
  });
  chrome.storage.local.set({ isFocusing: true, endTime });
  startCountdown(endTime);
}

function stopFocusMode() {
  clearInterval(timerInterval);
  updateBlockingRules([], false);
  chrome.storage.local.set({ isFocusing: false, endTime: null });

  if (timerDisplay) timerDisplay.textContent = "25:00";
  if (statusDisplay) statusDisplay.textContent = "Status:idle";
  if (toggleBtn) toggleBtn.textContent = "Start Focus Mode";
}

function startCountdown(endTime) {
  if (toggleBtn) toggleBtn.textContent = "Stop Focus Mode";
  if (statusDisplay) statusDisplay.textContent = "Status:blocking distraction";
  function update() {
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
    const secs = String(remaining % 60).padStart(2, "0");

    if (timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;

    if (remaining <= 0) {
      stopFocusMode();
      alert("Focus session Complete ! time to take a break.");
    }
  }
  update();
  timerInterval = setInterval(update, 1000);
}
function getfaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}
function renderlist(domains) {
  siteList.innerHTML = "";
  domains.forEach((domain) => {
    const li = document.createElement("li");
    li.className = "site-item";
    li.innerHTML = `
    <div class="site-info">
        <img class="site-icon" src="${getFaviconUrl(domain)}" alt="icon" onerror="this.src='https://google.com/favicon.ico'" />
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

if (addbtn) {
  addbtn.addEventListener("click", () => {
    let domain = siteInput.value.trim().toLowerCase();
    domain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0];
    if (!domain) return;
    chrome.storage.local(["blockedDomains", "isFocusing"], (data) => {
      const currentDomains = data.blockDomains || default_site;

      if (!currentDomains.includes(domain)) {
        const updateDomains = [...currentDomains, domain];
        chrome.storage.local.set({ blockDomains: updateDomains }, () => {
          renderlist(updateDomains);
          siteInput.value = "";

          if (data.isFocusing) {
            updateBlockingRules(updateDomains, true);
          }
        });
      }
    });
  });
}

// remove domain
function removeDomain(domainToRemove) {
  chrome.storage.local.get(["blockedDomains", "isFocusing"], (data) => {
    const currentDomains = data.blockedDomains || [];
    const updatedDomains = currentDomains.filter((d) => d !== domainToRemove);

    chrome.storage.local.set({ blockedDomains: updatedDomains }, () => {
      renderList(updatedDomains);

      if (data.isFocusing) {
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
