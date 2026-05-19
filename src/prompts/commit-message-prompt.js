const DEFAULT_MAX_DIFF_CHARS = 120_000;

function normalizeStyle(style) {
  if (typeof style !== "string" || !style.trim()) {
    return "conventional";
  }

  return style.trim().toLowerCase();
}

function normalizeScope(scope) {
  if (typeof scope !== "string") {
    return "";
  }

  return scope.trim();
}

function truncateDiff(diff, maxChars) {
  if (diff.length <= maxChars) {
    return diff;
  }

  const truncatedLength = diff.length - maxChars;
  return `${diff.slice(0, maxChars)}\n\n[Diff truncated: ${truncatedLength} characters omitted]`;
}

export function buildCommitMessageInstructions({ style = "conventional", scope = "" } = {}) {
  const normalizedStyle = normalizeStyle(style);
  const normalizedScope = normalizeScope(scope);
  const scopeRule = normalizedScope
    ? `Use scope "${normalizedScope}" when it naturally fits the change.`
    : "Do not invent a scope unless it adds clear value.";

  return [
    "You are an expert software engineer writing Git commit messages.",
    "Write one concise, professional commit message based on the staged diff.",
    `Follow ${normalizedStyle} commit style.`,
    scopeRule,
    "Focus on user-impacting change intent, not low-level patch noise.",
    "Return only the commit message text with no markdown fences and no explanations."
  ].join(" ");
}

export function buildCommitMessageInput(
  { branchName, stagedDiff, style = "conventional", scope = "" } = {},
  { maxDiffChars = DEFAULT_MAX_DIFF_CHARS } = {}
) {
  const normalizedStyle = normalizeStyle(style);
  const normalizedScope = normalizeScope(scope);
  const safeBranchName = branchName || "unknown";
  const safeDiff = truncateDiff(stagedDiff ?? "", maxDiffChars);

  return [
    `Branch: ${safeBranchName}`,
    `Requested style: ${normalizedStyle}`,
    `Requested scope: ${normalizedScope || "none"}`,
    "Staged git diff:",
    safeDiff
  ].join("\n");
}
