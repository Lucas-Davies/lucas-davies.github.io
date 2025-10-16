// ===============================
// FEEDBACK PAGE MODULE
// ===============================
export async function mount(host, ctx) {
  const { getSettings } = ctx;
  const cs = getSettings?.() || {};
  const st = ensureFeedbackState(cs);

  const title   = cs?.title || cs?.name || "Course Feedback";
  const heroUrl = cs?.preview?.heroUrl || "";
  const desc    = st.desc || "We’d love to hear your thoughts about this course.";

  host.innerHTML = `
    <div class="feedback-wrap">
      <div class="feedback-hero" style="background-image:url('${heroUrl}')">
        <div class="feedback-fade"></div>
      </div>

      <div class="feedback-content">
        <h1 class="feedback-title">${title}</h1>
        <p class="feedback-sub">${st.subtitle}</p>

        <div class="feedback-body">${desc}</div>

        <form class="feedback-form">
          <label>
            <span>How satisfied are you with this course?</span>
            <select name="rating" required>
              <option value="">Select</option>
              <option>⭐️⭐️⭐️⭐️⭐️ Excellent</option>
              <option>⭐️⭐️⭐️⭐️ Good</option>
              <option>⭐️⭐️⭐️ Fair</option>
              <option>⭐️⭐️ Poor</option>
              <option>⭐️ Very Poor</option>
            </select>
          </label>

          <label>
            <span>Any suggestions or comments?</span>
            <textarea name="comments" placeholder="Your feedback helps us improve..." rows="4"></textarea>
          </label>

          <button type="submit" class="feedback-btn">Submit Feedback</button>
        </form>
      </div>
    </div>
  `;

  // Submission handler
  const form = host.querySelector(".feedback-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    openFeedbackLightbox(data.rating, data.comments);
  });
}

function ensureFeedbackState(cs) {
  cs.feedback ||= {};
  const st = cs.feedback;
  st.subtitle ||= "Share your experience";
  st.desc ||= "We’re always looking to improve our courses. Please take a moment to provide your feedback.";
  return st;
}

function openFeedbackLightbox(rating, comments) {
  const wrap = document.createElement("div");
  wrap.className = "feedback-lightbox";
  wrap.innerHTML = `
    <div class="feedback-lightbox-inner">
      <h2>Thank You!</h2>
      <p>We appreciate your feedback.</p>
      ${
        rating
          ? `<p><strong>Your rating:</strong> ${rating}</p>`
          : ""
      }
      ${
        comments
          ? `<p><strong>Your comment:</strong> ${escapeHtml(comments)}</p>`
          : ""
      }
      <div class="feedback-confirm-actions">
        <button class="close-btn" data-act="close">Close</button>
      </div>
    </div>
  `;
  wrap.addEventListener("click", (e) => {
    if (e.target.dataset.act === "close" || e.target === wrap) wrap.remove();
  });
  document.body.appendChild(wrap);
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function unmount(host) {
  try { host.innerHTML = ""; } catch {}
} 