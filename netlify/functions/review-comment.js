// Netlify serverless function — proxies review comments to a GitHub Issue.
// Auto-creates the issue on first comment for a given post title.
// Requires GITHUB_REVIEW_TOKEN env var (fine-grained PAT with Issues write scope).

const REPO = "LLM360/website";

async function ghFetch(path, options = {}) {
  const TOKEN = process.env.GITHUB_REVIEW_TOKEN;
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "llm360-review-overlay",
      ...options.headers,
    },
  });
  return res;
}

async function findOrCreateIssue(postSlug, postTitle) {
  const slugTag = `[review/${postSlug}]`;

  // Search for existing issue by slug tag in title
  const searchRes = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(slugTag)}+repo:${REPO}+is:issue+is:open&per_page=5`,
    {
      headers: {
        Authorization: `token ${process.env.GITHUB_REVIEW_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "llm360-review-overlay",
      },
    }
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    const match = data.items && data.items.find((i) => i.title.includes(slugTag));
    if (match) return match.number;
  }

  // No existing issue — create one with human-readable title + stable slug tag
  const issueTitle = `Review: ${postTitle || postSlug} ${slugTag}`;
  const createRes = await ghFetch("/issues", {
    method: "POST",
    body: JSON.stringify({
      title: issueTitle,
      body: `Inline review comments for the blog post: **${postTitle || postSlug}**.\n\nAuto-created by the review overlay on the first comment.`,
      labels: ["review"],
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create issue: ${createRes.status}`);
  }

  const issue = await createRes.json();
  return issue.number;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  const TOKEN = process.env.GITHUB_REVIEW_TOKEN;
  if (!TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "GITHUB_REVIEW_TOKEN not configured" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { postTitle, postSlug, body, displayName, anchor } = payload;

  if (!postSlug || !body) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing postTitle or body" }),
    };
  }

  try {
    // Find or create the review issue for this post
    const issueNumber = await findOrCreateIssue(postSlug, postTitle);

    // Build the comment body with embedded anchor metadata
    const name = displayName || "Anonymous";
    const quote =
      anchor && anchor.exact
        ? `> "${anchor.exact.slice(0, 300)}${anchor.exact.length > 300 ? "..." : ""}"\n\n`
        : "";
    const meta = JSON.stringify({ name, anchor });
    const commentBody = `**${name}** commented:\n${quote}${body}\n\n<!-- review:${meta} -->`;

    const res = await ghFetch(`/issues/${issueNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentBody }),
    });

    const responseBody = await res.text();

    return {
      statusCode: res.status,
      headers: { ...headers, "Content-Type": "application/json" },
      body: responseBody,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
