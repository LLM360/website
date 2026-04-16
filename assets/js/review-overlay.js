/* ═══════════════════════════════════════════════════════════════
   Review Overlay — inline draft-review comments for preview builds
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var CFG = window.__REVIEW_CONFIG;
  if (!CFG || !CFG.postTitle) return;

  var REPO = CFG.repo || "LLM360/website";
  var POST_TITLE = CFG.postTitle;
  var FN_URL = CFG.functionUrl || "/.netlify/functions/review-comment";
  var issueNumber = null; // discovered at load time

  // Content container — al-folio wraps post body in <article class="post-content">
  var CONTENT_SELECTOR = "article.post-content";

  // ── State ────────────────────────────────────────────────────
  var comments = [];
  var highlightMap = {}; // commentId → [mark elements]
  var sidebarOpen = false;
  var currentAnchor = null;

  // ═══════════════════════════════════════════════════════════════
  //  Text-quote selector (minimal W3C Web Annotation compatible)
  // ═══════════════════════════════════════════════════════════════

  function findTextQuote(root, selector) {
    if (!selector || !selector.exact) return null;
    var text = root.textContent;
    var exact = selector.exact;
    var startIdx = 0;

    while (true) {
      var idx = text.indexOf(exact, startIdx);
      if (idx === -1) return null;

      if (selector.prefix) {
        var pStart = idx - selector.prefix.length;
        if (pStart < 0 || text.slice(pStart, idx) !== selector.prefix) {
          startIdx = idx + 1;
          continue;
        }
      }
      if (selector.suffix) {
        var sEnd = idx + exact.length + selector.suffix.length;
        if (sEnd > text.length || text.slice(idx + exact.length, sEnd) !== selector.suffix) {
          startIdx = idx + 1;
          continue;
        }
      }
      return textOffsetToRange(root, idx, idx + exact.length);
    }
  }

  function textOffsetToRange(root, start, end) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var off = 0;
    var startNode, startOff, endNode, endOff;

    while (walker.nextNode()) {
      var node = walker.currentNode;
      var len = node.textContent.length;
      if (!startNode && off + len > start) {
        startNode = node;
        startOff = start - off;
      }
      if (!endNode && off + len >= end) {
        endNode = node;
        endOff = end - off;
        break;
      }
      off += len;
    }
    if (!startNode || !endNode) return null;

    var range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    return range;
  }

  function createAnchorFromSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;

    var range = sel.getRangeAt(0);
    var contentEl = document.querySelector(CONTENT_SELECTOR);
    if (!contentEl || !contentEl.contains(range.commonAncestorContainer)) return null;

    var exact = range.toString().trim();
    if (!exact || exact.length < 3) return null;

    var fullText = contentEl.textContent;
    var idx = fullText.indexOf(exact);
    if (idx === -1) return { exact: exact };

    var pStart = Math.max(0, idx - 40);
    var sEnd = Math.min(fullText.length, idx + exact.length + 40);

    return {
      exact: exact,
      prefix: fullText.slice(pStart, idx),
      suffix: fullText.slice(idx + exact.length, sEnd),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GitHub API
  // ═══════════════════════════════════════════════════════════════

  function fetchComments() {
    var searchTitle = "Review: " + POST_TITLE;
    var q = encodeURIComponent(searchTitle) + "+repo:" + REPO + "+is:issue+is:open";

    return fetch(
      "https://api.github.com/search/issues?q=" + q + "&per_page=5",
      { headers: { Accept: "application/vnd.github.v3+json" } }
    )
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (data) {
        var match = (data.items || []).find(function (i) { return i.title === searchTitle; });
        if (!match) return []; // no review issue yet — that's fine
        issueNumber = match.number;
        return fetch(
          "https://api.github.com/repos/" + REPO + "/issues/" + issueNumber + "/comments?per_page=100",
          { headers: { Accept: "application/vnd.github.v3+json" } }
        );
      })
      .then(function (r) {
        if (Array.isArray(r)) return r; // early return from no-match path
        return r.ok ? r.json() : [];
      })
      .then(function (items) {
        return items
          .map(parseComment)
          .filter(function (c) { return c !== null; });
      })
      .catch(function () { return []; });
  }

  function parseComment(item) {
    var body = item.body || "";
    var match = body.match(/<!-- review:(.*?) -->/);
    if (!match) return null;

    var meta;
    try { meta = JSON.parse(match[1]); } catch (e) { return null; }

    var displayBody = body.slice(0, match.index).trim();
    // Strip the leading "**Name** commented:" line
    displayBody = displayBody.replace(/^\*\*.*?\*\*\s*commented:\s*/i, "");
    // Extract blockquote if present
    var quoteMatch = displayBody.match(/^>\s*"(.+?)"\s*\n?([\s\S]*)$/);
    var quote = "";
    if (quoteMatch) {
      quote = quoteMatch[1];
      displayBody = quoteMatch[2].trim();
    }

    return {
      id: item.id,
      name: meta.name || "Anonymous",
      anchor: meta.anchor || null,
      quote: quote,
      body: displayBody,
      created: item.created_at,
      url: item.html_url,
    };
  }

  function postComment(displayName, text, anchor) {
    // Try the Netlify Function first; fall back to direct GitHub API for local dev
    return postViaFunction(displayName, text, anchor).catch(function () {
      return postDirectToGitHub(displayName, text, anchor);
    });
  }

  function postViaFunction(displayName, text, anchor) {
    return fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postTitle: POST_TITLE,
        body: text,
        displayName: displayName,
        anchor: anchor,
      }),
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function postDirectToGitHub(displayName, text, anchor) {
    var token = localStorage.getItem("rv-github-token");
    if (!token) {
      token = prompt(
        "Netlify Function unavailable (local dev).\n\n" +
        "Enter a GitHub PAT with Issues write scope to post directly.\n" +
        "It will be saved in localStorage for this session."
      );
      if (!token) return Promise.reject(new Error("No token provided"));
      localStorage.setItem("rv-github-token", token);
    }

    var authHeaders = {
      Authorization: "token " + token,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    // Find or create issue
    return findOrCreateIssueDirect(token).then(function (num) {
      var name = displayName || "Anonymous";
      var quote = anchor && anchor.exact
        ? '> "' + anchor.exact.slice(0, 300) + (anchor.exact.length > 300 ? "..." : "") + '"\n\n'
        : "";
      var meta = JSON.stringify({ name: name, anchor: anchor });
      var commentBody = "**" + name + "** commented:\n" + quote + text + "\n\n<!-- review:" + meta + " -->";

      return fetch(
        "https://api.github.com/repos/" + REPO + "/issues/" + num + "/comments",
        { method: "POST", headers: authHeaders, body: JSON.stringify({ body: commentBody }) }
      );
    }).then(function (r) {
      if (r.status === 401) {
        localStorage.removeItem("rv-github-token");
        throw new Error("Bad token — cleared, try again");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function findOrCreateIssueDirect(token) {
    if (issueNumber) return Promise.resolve(issueNumber);

    var searchTitle = "Review: " + POST_TITLE;
    var q = encodeURIComponent(searchTitle) + "+repo:" + REPO + "+is:issue+is:open";
    var authHeaders = {
      Authorization: "token " + token,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    return fetch("https://api.github.com/search/issues?q=" + q + "&per_page=5", { headers: authHeaders })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (data) {
        var match = (data.items || []).find(function (i) { return i.title === searchTitle; });
        if (match) {
          issueNumber = match.number;
          return issueNumber;
        }
        // Create it
        return fetch("https://api.github.com/repos/" + REPO + "/issues", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            title: searchTitle,
            body: "Inline review comments for: **" + POST_TITLE + "**\n\nAuto-created by the review overlay.",
          }),
        }).then(function (r) { return r.json(); })
          .then(function (issue) {
            issueNumber = issue.number;
            return issueNumber;
          });
      });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Highlight painting
  // ═══════════════════════════════════════════════════════════════

  function paintHighlight(anchor, commentId) {
    if (!anchor || !anchor.exact) return [];
    var contentEl = document.querySelector(CONTENT_SELECTOR);
    if (!contentEl) return [];

    var range = findTextQuote(contentEl, anchor);
    if (!range) return [];

    var marks = [];
    // Handle multi-node ranges by wrapping each text node segment
    var frag = range.cloneContents();
    var walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // Simple case: use surroundContents if possible
    try {
      var mark = document.createElement("mark");
      mark.className = "rv-highlight";
      mark.dataset.commentId = commentId;
      range.surroundContents(mark);
      marks.push(mark);
    } catch (e) {
      // Complex case: range spans multiple elements — highlight each text node
      var iter = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
      var inRange = false;
      var rangeText = anchor.exact;
      var remaining = rangeText;

      while (iter.nextNode()) {
        var node = iter.currentNode;
        var nodeText = node.textContent;

        if (!inRange) {
          var startPos = nodeText.indexOf(remaining.slice(0, Math.min(remaining.length, nodeText.length)));
          if (startPos === -1) continue;
          inRange = true;

          var mark = document.createElement("mark");
          mark.className = "rv-highlight";
          mark.dataset.commentId = commentId;

          if (remaining.length <= nodeText.length - startPos) {
            // Entire remaining text fits in this node
            var r = document.createRange();
            r.setStart(node, startPos);
            r.setEnd(node, startPos + remaining.length);
            r.surroundContents(mark);
            marks.push(mark);
            break;
          } else {
            var r = document.createRange();
            r.setStart(node, startPos);
            r.setEnd(node, nodeText.length);
            r.surroundContents(mark);
            marks.push(mark);
            remaining = remaining.slice(nodeText.length - startPos);
          }
        } else {
          var mark = document.createElement("mark");
          mark.className = "rv-highlight";
          mark.dataset.commentId = commentId;

          if (remaining.length <= nodeText.length) {
            var r = document.createRange();
            r.setStart(node, 0);
            r.setEnd(node, remaining.length);
            r.surroundContents(mark);
            marks.push(mark);
            break;
          } else {
            var r = document.createRange();
            r.setStart(node, 0);
            r.setEnd(node, nodeText.length);
            r.surroundContents(mark);
            marks.push(mark);
            remaining = remaining.slice(nodeText.length);
          }
        }
      }
    }

    highlightMap[commentId] = marks;
    marks.forEach(function (m) {
      m.addEventListener("click", function () {
        openSidebar();
        scrollToComment(commentId);
      });
    });

    return marks;
  }

  function paintAllHighlights(cmts) {
    cmts.forEach(function (c) {
      paintHighlight(c.anchor, c.id);
    });
  }

  function pulseHighlight(commentId) {
    var marks = highlightMap[commentId] || [];
    marks.forEach(function (m) {
      m.classList.add("rv-active");
      setTimeout(function () { m.classList.remove("rv-active"); }, 1500);
    });
    if (marks.length) {
      marks[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  UI — Banner
  // ═══════════════════════════════════════════════════════════════

  function createBanner() {
    var el = document.createElement("div");
    el.className = "rv-banner";
    el.textContent = "REVIEW MODE — Select text to leave inline comments";
    document.body.appendChild(el);
    // Push body content down
    document.body.style.marginTop = (el.offsetHeight) + "px";
  }

  // ═══════════════════════════════════════════════════════════════
  //  UI — Floating bubble
  // ═══════════════════════════════════════════════════════════════

  var bubbleEl;

  function createBubble() {
    bubbleEl = document.createElement("button");
    bubbleEl.className = "rv-bubble";
    bubbleEl.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2z"/></svg>' +
      " Comment";
    bubbleEl.addEventListener("mousedown", function (e) {
      e.preventDefault(); // Don't lose selection
      e.stopPropagation();
      openComposer();
    });
    document.body.appendChild(bubbleEl);
  }

  function positionBubble(rect) {
    bubbleEl.style.display = "flex";
    bubbleEl.style.top = (window.scrollY + rect.top - 42) + "px";
    bubbleEl.style.left = (window.scrollX + rect.left + rect.width / 2 - 50) + "px";
  }

  function hideBubble() {
    if (bubbleEl) bubbleEl.style.display = "none";
  }

  // ═══════════════════════════════════════════════════════════════
  //  UI — Composer
  // ═══════════════════════════════════════════════════════════════

  var composerBackdrop, composerName, composerBody, composerQuote, composerSubmit;

  function createComposer() {
    composerBackdrop = document.createElement("div");
    composerBackdrop.className = "rv-composer-backdrop";
    composerBackdrop.innerHTML =
      '<div class="rv-composer">' +
      '  <div class="rv-composer-quote"></div>' +
      '  <label for="rv-name">Your name</label>' +
      '  <input id="rv-name" type="text" placeholder="e.g. Hector" />' +
      '  <label for="rv-body">Comment</label>' +
      '  <textarea id="rv-body" placeholder="What do you think about this section?"></textarea>' +
      '  <div class="rv-composer-actions">' +
      '    <button class="rv-btn rv-cancel">Cancel</button>' +
      '    <button class="rv-btn rv-btn-primary rv-submit">Post</button>' +
      '  </div>' +
      "</div>";

    document.body.appendChild(composerBackdrop);

    composerQuote = composerBackdrop.querySelector(".rv-composer-quote");
    composerName = composerBackdrop.querySelector("#rv-name");
    composerBody = composerBackdrop.querySelector("#rv-body");
    composerSubmit = composerBackdrop.querySelector(".rv-submit");

    // Restore saved name
    var savedName = localStorage.getItem("rv-display-name");
    if (savedName) composerName.value = savedName;

    composerBackdrop.querySelector(".rv-cancel").addEventListener("click", closeComposer);
    composerBackdrop.addEventListener("click", function (e) {
      if (e.target === composerBackdrop) closeComposer();
    });
    composerSubmit.addEventListener("click", submitComment);
  }

  function openComposer() {
    var anchor = createAnchorFromSelection();
    if (!anchor) return;

    currentAnchor = anchor;
    composerQuote.textContent = '"' + anchor.exact.slice(0, 200) + (anchor.exact.length > 200 ? "..." : "") + '"';
    composerBody.value = "";
    composerBackdrop.classList.add("rv-open");
    hideBubble();

    setTimeout(function () { composerBody.focus(); }, 60);
  }

  function closeComposer() {
    composerBackdrop.classList.remove("rv-open");
    currentAnchor = null;
  }

  function submitComment() {
    var name = composerName.value.trim() || "Anonymous";
    var body = composerBody.value.trim();
    if (!body) return;

    localStorage.setItem("rv-display-name", name);
    composerSubmit.disabled = true;
    composerSubmit.textContent = "Posting...";

    postComment(name, body, currentAnchor)
      .then(function (resp) {
        var newComment = parseComment(resp);
        if (newComment) {
          comments.push(newComment);
          paintHighlight(newComment.anchor, newComment.id);
          renderSidebar();
          updateBadge();
        }
        closeComposer();
        showToast("Comment posted");
      })
      .catch(function (err) {
        console.error("[review]", err);
        showToast("Failed to post — check console");
      })
      .finally(function () {
        composerSubmit.disabled = false;
        composerSubmit.textContent = "Post";
      });
  }

  // ═══════════════════════════════════════════════════════════════
  //  UI — Sidebar
  // ═══════════════════════════════════════════════════════════════

  var sidebarEl, sidebarBody, toggleEl, badgeEl;

  function createSidebar() {
    sidebarEl = document.createElement("div");
    sidebarEl.className = "rv-sidebar";
    sidebarEl.innerHTML =
      '<div class="rv-sidebar-header">' +
      "  <h3>Review Comments</h3>" +
      '  <button class="rv-sidebar-close">&times;</button>' +
      "</div>" +
      '<div class="rv-sidebar-body"></div>';

    document.body.appendChild(sidebarEl);
    sidebarBody = sidebarEl.querySelector(".rv-sidebar-body");
    sidebarEl.querySelector(".rv-sidebar-close").addEventListener("click", closeSidebar);
  }

  function createToggle() {
    toggleEl = document.createElement("button");
    toggleEl.className = "rv-toggle";
    toggleEl.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2z"/></svg>';
    badgeEl = document.createElement("span");
    badgeEl.className = "rv-toggle-badge";
    badgeEl.style.display = "none";
    toggleEl.appendChild(badgeEl);
    toggleEl.addEventListener("click", function () {
      sidebarOpen ? closeSidebar() : openSidebar();
    });
    document.body.appendChild(toggleEl);
  }

  function updateBadge() {
    if (!badgeEl) return;
    if (comments.length > 0) {
      badgeEl.textContent = comments.length;
      badgeEl.style.display = "";
    } else {
      badgeEl.style.display = "none";
    }
  }

  function openSidebar() {
    sidebarEl.classList.add("rv-open");
    sidebarOpen = true;
  }

  function closeSidebar() {
    sidebarEl.classList.remove("rv-open");
    sidebarOpen = false;
  }

  function renderSidebar() {
    if (!sidebarBody) return;

    if (comments.length === 0) {
      sidebarBody.innerHTML =
        '<div class="rv-sidebar-empty">' +
        "  <p>No review comments yet.</p>" +
        "  <p>Select text in the post to leave a comment.</p>" +
        "</div>";
      return;
    }

    sidebarBody.innerHTML = "";
    comments.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "rv-comment";
      card.dataset.commentId = c.id;

      var time = c.created
        ? new Date(c.created).toLocaleDateString("en-US", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })
        : "";

      var quoteHtml = c.quote
        ? '<div class="rv-comment-quote">"' + escapeHtml(c.quote.slice(0, 120)) + '"</div>'
        : "";

      card.innerHTML =
        '<div class="rv-comment-header">' +
        '  <span class="rv-comment-name">' + escapeHtml(c.name) + "</span>" +
        '  <span class="rv-comment-time">' + escapeHtml(time) + "</span>" +
        "</div>" +
        quoteHtml +
        '<div class="rv-comment-body">' + escapeHtml(c.body) + "</div>";

      card.addEventListener("click", function () {
        pulseHighlight(c.id);
      });

      sidebarBody.appendChild(card);
    });
  }

  function scrollToComment(commentId) {
    var card = sidebarBody.querySelector('[data-comment-id="' + commentId + '"]');
    if (card) {
      sidebarBody.querySelectorAll(".rv-comment").forEach(function (c) {
        c.classList.remove("rv-active");
      });
      card.classList.add("rv-active");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  UI — Toast
  // ═══════════════════════════════════════════════════════════════

  var toastEl;

  function createToast() {
    toastEl = document.createElement("div");
    toastEl.className = "rv-toast";
    document.body.appendChild(toastEl);
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("rv-visible");
    setTimeout(function () { toastEl.classList.remove("rv-visible"); }, 2500);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Selection listener
  // ═══════════════════════════════════════════════════════════════

  function onSelectionChange() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length < 3) {
      hideBubble();
      return;
    }

    var contentEl = document.querySelector(CONTENT_SELECTOR);
    if (!contentEl) return;

    // Only show bubble for selections inside the post content
    var anchor = sel.anchorNode;
    var focus = sel.focusNode;
    if (!contentEl.contains(anchor) || !contentEl.contains(focus)) {
      hideBubble();
      return;
    }

    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    positionBubble(rect);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Utilities
  // ═══════════════════════════════════════════════════════════════

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Init
  // ═══════════════════════════════════════════════════════════════

  function init() {
    createBanner();
    createBubble();
    createComposer();
    createSidebar();
    createToggle();
    createToast();

    document.addEventListener("selectionchange", onSelectionChange);

    // Hide bubble on click outside content area
    document.addEventListener("mousedown", function (e) {
      if (bubbleEl && !bubbleEl.contains(e.target)) {
        hideBubble();
      }
    });

    // Load existing comments
    fetchComments().then(function (cmts) {
      comments = cmts;
      paintAllHighlights(comments);
      renderSidebar();
      updateBadge();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
