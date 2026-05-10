const COMMENTS_API = "https://dugout-comments-api.flg.workers.dev/comments";


const DEFAULT_NAMES = [
  "Bryce",
  "Justin",
  "Wagner",
  "JohnnySack",
  "Team Lill",
  "SlammingMuff",
  "Ice",
  "VinSalv",
  "Sarrel",
  "Moltisanti’s Mistress",
  "Other"
];


document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".comments-widget").forEach(initCommentsWidget);
});


async function initCommentsWidget(widget) {
  const page = widget.dataset.page;
  const section = widget.dataset.section;
  const title = widget.dataset.title || "Comments";


  widget.innerHTML = `
    <details class="comments-box">
      <summary>
        <span>💬 ${title}</span>
        <strong class="comment-count">Loading...</strong>
      </summary>


      <div class="comments-inner">
        <div class="comments-list">
          <p class="comments-muted">Loading comments...</p>
        </div>


        <form class="comment-form">
          <label>
            Name
            <select class="comment-name">
              ${DEFAULT_NAMES.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
            </select>
          </label>


          <input class="comment-other-name" type="text" placeholder="Enter your name" style="display:none;" maxlength="30" />


          <label>
            Comment
            <textarea class="comment-text" placeholder="Talk your shit..." maxlength="500" required></textarea>
          </label>


          <button type="submit">Post Comment</button>
          <p class="comments-muted">Keep it funny. Commissioner reserves the right to delete nonsense later.</p>
        </form>
      </div>
    </details>
  `;


  const nameSelect = widget.querySelector(".comment-name");
  const otherName = widget.querySelector(".comment-other-name");
  const form = widget.querySelector(".comment-form");


  nameSelect.addEventListener("change", () => {
    otherName.style.display = nameSelect.value === "Other" ? "block" : "none";
  });


  form.addEventListener("submit", async (e) => {
    e.preventDefault();


    const selectedName = nameSelect.value;
    const displayName = selectedName === "Other" ? otherName.value.trim() : selectedName;
    const commentText = widget.querySelector(".comment-text").value.trim();


    if (!displayName || !commentText) return;


    form.querySelector("button").disabled = true;
    form.querySelector("button").textContent = "Posting...";


    try {
      await fetch(COMMENTS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          page_slug: page,
          section_slug: section,
          display_name: displayName,
          comment_text: commentText
        })
      });


      widget.querySelector(".comment-text").value = "";
      await loadComments(widget, page, section);
    } catch (err) {
      alert("Comment failed to post. Try again.");
    }


    form.querySelector("button").disabled = false;
    form.querySelector("button").textContent = "Post Comment";
  });


  await loadComments(widget, page, section);
}


async function loadComments(widget, page, section) {
  const list = widget.querySelector(".comments-list");
  const count = widget.querySelector(".comment-count");


  try {
    const res = await fetch(`${COMMENTS_API}?page=${encodeURIComponent(page)}&section=${encodeURIComponent(section)}`);
    const data = await res.json();
    const comments = data.comments || [];


    count.textContent = `${comments.length} comment${comments.length === 1 ? "" : "s"}`;


    if (comments.length === 0) {
      list.innerHTML = `<p class="comments-muted">No comments yet. Be the first menace.</p>`;
      return;
    }


    list.innerHTML = comments.map((comment) => `
      <div class="comment-item">
        <div class="comment-head">
          <strong>${escapeHtml(comment.display_name)}</strong>
          <span>${formatCommentDate(comment.created_at)}</span>
        </div>
        <p>${escapeHtml(comment.comment_text)}</p>
      </div>
    `).join("");
  } catch (err) {
    count.textContent = "Unavailable";
    list.innerHTML = `<p class="comments-muted">Comments could not load.</p>`;
  }
}


function formatCommentDate(value) {
  if (!value) return "";


  // D1 CURRENT_TIMESTAMP returns UTC like: "2026-05-10 03:56:00"
  // JavaScript needs the "Z" to understand it is UTC.
  const normalizedValue = String(value).includes("T")
    ? value
    : String(value).replace(" ", "T") + "Z";


  const date = new Date(normalizedValue);


  if (Number.isNaN(date.getTime())) {
    return "";
  }


  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}


function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


