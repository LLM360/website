// Netlify serverless function — proxies review comments to a GitHub Issue.
// Requires GITHUB_REVIEW_TOKEN env var (fine-grained PAT with Issues write scope).

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

  const { issueNumber, body, displayName, anchor } = payload;

  if (!issueNumber || !body) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing issueNumber or body" }),
    };
  }

  // Build the comment body with embedded anchor metadata
  const name = displayName || "Anonymous";
  const quote =
    anchor && anchor.exact
      ? `> "${anchor.exact.slice(0, 300)}${anchor.exact.length > 300 ? "..." : ""}"\n\n`
      : "";
  const meta = JSON.stringify({ name, anchor });
  const commentBody = `**${name}** commented:\n${quote}${body}\n\n<!-- review:${meta} -->`;

  const REPO = "LLM360/website";
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "llm360-review-overlay",
      },
      body: JSON.stringify({ body: commentBody }),
    }
  );

  const responseBody = await res.text();

  return {
    statusCode: res.status,
    headers: { ...headers, "Content-Type": "application/json" },
    body: responseBody,
  };
};
