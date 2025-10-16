// ===============================
// ACHIEVEMENT PAGE MODULE
// ===============================
export async function mount(host, ctx) {
  const { getSettings } = ctx;
  const cs = getSettings?.() || {};
  const st = ensureAchievementState(cs);

  const title   = cs?.title || cs?.name || "Achievement Unlocked";
  const heroUrl = cs?.preview?.heroUrl || "";
  const desc    = st.desc || "Congratulations! You’ve successfully completed this course.";

  host.innerHTML = `
    <div class="achievement-wrap">
      <div class="achievement-hero" style="background-image:url('${heroUrl}')">
        <div class="achievement-fade"></div>
      </div>

      <div class="achievement-content">
        <h1 class="achievement-title">${title}</h1>
        <p class="achievement-sub">${st.subtitle}</p>

        <div class="achievement-body">${desc}</div>

        ${renderStats(st)}

        <div class="achievement-actions">
          ${st.certificateUrl
            ? `<button class="achievement-btn" data-act="view-cert">View Certificate</button>`
            : `<button class="achievement-btn" data-act="claim-cert">Claim Certificate</button>`
          }
          ${st.shareEnabled ? `<button class="achievement-btn ghost" data-act="share">Share</button>` : ""}
        </div>

        ${st.badgeUrl ? `<div class="achievement-badge"><img alt="Course Badge" src="${st.badgeUrl}" /></div>` : ""}
      </div>
    </div>
  `;

  // Actions
  host.querySelector('[data-act="view-cert"]')?.addEventListener('click', () => {
    openCertLightbox(st.certificateUrl);
  });

  host.querySelector('[data-act="claim-cert"]')?.addEventListener('click', async () => {
    // Simulate claim → set a dummy URL then show
    st.certificateUrl ||= st.claimEndpoint || "about:blank";
    openCertLightbox(st.certificateUrl, !st.claimEndpoint); // if dummy, show placeholder
  });

  host.querySelector('[data-act="share"]')?.addEventListener('click', () => {
    openShareLightbox(st.shareText, st.shareUrl);
  });
}

function ensureAchievementState(cs) {
  cs.achievement ||= {};
  const st = cs.achievement;

  // Copy-friendly defaults
  st.subtitle       ||= "You did it!";
  st.desc           ||= "Your dedication and effort paid off. Keep the momentum going!";
  st.scoreLabel     ||= "Score";
  st.scoreValue     ||= cs.progress?.score ?? "100%";
  st.hoursLabel     ||= "Time Spent";
  st.hoursValue     ||= cs.progress?.hours ?? "6h 20m";
  st.dateLabel      ||= "Completed";
  st.dateValue      ||= new Date().toLocaleDateString();

  // Media / assets
  st.certificateUrl ||= "";            // direct URL to a PDF or hosted cert
  st.claimEndpoint  ||= "";            // optional endpoint if you claim instead
  st.badgeUrl       ||= "";            // optional badge image

  // Social / share
  st.shareEnabled   ??= true;
  st.shareText      ||= "I just completed a course!";
  st.shareUrl       ||= (typeof location !== "undefined" ? location.href : "");

  return st;
}

function renderStats(st) {
  return `
    <div class="achievement-stats">
      <div class="stat">
        <div class="stat-label">${st.scoreLabel}</div>
        <div class="stat-value">${st.scoreValue}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${st.hoursLabel}</div>
        <div class="stat-value">${st.hoursValue}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${st.dateLabel}</div>
        <div class="stat-value">${st.dateValue}</div>
      </div>
    </div>
  `;
}

/* --------------------------- Lightboxes --------------------------- */
function openCertLightbox(url, showPlaceholder = false) {
  const wrap = document.createElement("div");
  wrap.className = "achievement-lightbox";
  wrap.innerHTML = `
    <div class="achievement-lightbox-inner">
      <button class="close-btn" aria-label="Close">✕</button>
      ${
        showPlaceholder || !url || url === "about:blank"
          ? `<div class="cert-placeholder">Certificate will appear here once generated.</div>`
          : `
            ${/\.pdf($|\?)/i.test(url)
              ? `<iframe class="cert-frame" src="${url}" title="Certificate" allow="encrypted-media"></iframe>`
              : `<img class="cert-image" src="${url}" alt="Certificate" />`
            }
          `
      }
      <div class="lightbox-actions">
        ${url && url !== "about:blank" ? `<a class="download-btn" href="${url}" target="_blank" rel="noopener">Download</a>` : ""}
        <button class="close-btn primary">Close</button>
      </div>
    </div>
  `;
  wrap.addEventListener("click", (e) => {
    if (e.target.classList.contains("close-btn") || e.target === wrap) wrap.remove();
  });
  document.body.appendChild(wapSafe(wrap));
}

function openShareLightbox(text = "", shareUrl = "") {
  const wrap = document.createElement("div");
  wrap.className = "achievement-lightbox";
  wrap.innerHTML = `
    <div class="achievement-lightbox-inner">
      <button class="close-btn" aria-label="Close">✕</button>
      <h2>Share your achievement</h2>
      <p>${escapeHtml(text)}</p>
      <div class="share-row">
        <input class="share-link" value="${escapeHtml(shareUrl)}" readonly />
        <button class="copy-btn">Copy</button>
      </div>
      <div class="lightbox-actions">
        <button class="close-btn primary">Close</button>
      </div>
    </div>
  `;
  wrap.addEventListener("click", (e) => {
    if (e.target.classList.contains("close-btn") || e.target === wrap) wrap.remove();
    if (e.target.classList.contains("copy-btn")) {
      const input = wrap.querySelector(".share-link");
      input?.select();
      document.execCommand?.("copy");
      e.target.textContent = "Copied!";
      setTimeout(() => (e.target.textContent = "Copy"), 1200);
    }
  });
  document.body.appendChild(wapSafe(wrap));
}

/* --------------------------- Utils --------------------------- */
function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wapSafe(el) {
  // small guard if DOM insertion is delayed
  try { return el; } catch { return el; }
}

export async function unmount(host) {
  try { host.innerHTML = ""; } catch {}
} 

