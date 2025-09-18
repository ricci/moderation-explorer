// Mastodon API endpoints
const SEARCH_ENDPOINT = "/api/v2/search";
const ACCOUNT_ENDPOINT = "/api/v1/accounts/";
const INSTANCE_ENDPOINT = "/api/v2/instance";
const PEERS_ENDPOINT = "/api/v1/instance/peers";
const ACTIVITY_ENDPOINT = "/api/v1/instance/activity";
const RULES_ENDPOINT = "/api/v1/instance/rules";
const BLOCKS_ENDPOINT = "/api/v1/instance/domain_blocks";
const VERIFY_ENDPOINT = "/api/v1/accounts/verify_credentials";

// Split a username in the form user@domain or @user@domain
// into parts; throws an error if username is not in the
// correct form
function splitUsername (username) {
  const parts = username.split('@');
  if (parts.length == 2) {
    // user@domain form
    if (parts[0] && parts[1]) {
      return [parts[0], parts[1]];
    }
  } else if (parts.length == 3) {
    // @user@domain form
    if ((!parts[0]) && parts[1] && parts[2]) {
      return [parts[1], parts[2]];
    }
  }
  
  throw new Error("Username " + username + " not in correct form");
}


// Code for fetching followers/following - paginates, retries, tries to play
// nice with rate limits, all that stuff
async function fetchAccountRelation({
  baseUrl,
  accountId,
  relation = "followers",
  token,
  limit = 80,
  maxPages = Infinity,
  //maxPages = 2,
  onPage
}) {
  if (!baseUrl || !accountId) throw new Error("baseUrl and accountId are required");
  if (relation !== "followers" && relation !== "following") {
    throw new Error('relation must be "followers" or "following"');
  }

  let url = new URL(`/api/v1/accounts/${encodeURIComponent(accountId)}/${relation}`, baseUrl);
  url.searchParams.set("limit", String(Math.min(limit, 80)));

  const all = [];
  const seenIds = new Set();
  let pageIndex = 0;

  while (url && pageIndex < maxPages) {
    const { items, links } = await fetchMastoPage(url, token);

    if (onPage) onPage(items, pageIndex);

    for (const acct of items) {
      if (!seenIds.has(acct.id)) {
        seenIds.add(acct.id);
        all.push(acct);
      }
    }

    url = links.next ? new URL(links.next) : null; // follow older pages
    pageIndex += 1;
  }

  return all;
}

// Convenience wrappers
function fetchAllFollowers(opts) {
  return fetchAccountRelation({ ...opts, relation: "followers" });
}
function fetchAllFollowing(opts) {
  return fetchAccountRelation({ ...opts, relation: "following" });
}

/* ---------- internals ---------- */
async function fetchMastoPage(url, token) {
  var headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  console.log(headers);

  const res = await fetchWithRetries(url.toString(), { headers });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`HTTP ${res.status} fetching ${url} – ${text.slice(0, 500)}`);
  }

  const items = await res.json();
  const linkHeader = res.headers.get("Link") || res.headers.get("link") || "";
  const links = parseLinkHeader(linkHeader);
  return { items, links };
}

async function fetchWithRetries(url, init, { retries = 5 } = {}) {
  let attempt = 0, base = 500;
  while (true) {
    const res = await fetch(url, init);

    if (res.status === 429 && attempt < retries) {
      const ra = res.headers.get("Retry-After");
      const waitMs = ra ? Math.max(0, parseFloat(ra) * 1000) : base * (attempt + 1) + Math.random() * 250;
      await new Promise(r => setTimeout(r, waitMs));
      attempt++; continue;
    }
    if (res.status >= 500 && res.status < 600 && attempt < retries) {
      const waitMs = base * (attempt + 1) + Math.random() * 250;
      await new Promise(r => setTimeout(r, waitMs));
      attempt++; continue;
    }
    return res;
  }
}

function parseLinkHeader(linkHeader) {
  const out = { next: null, prev: null };
  if (!linkHeader) return out;
  const parts = linkHeader.split(/,\s*(?=<)/);
  for (const part of parts) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/i);
    if (!m) continue;
    const [, url, rel] = m;
    if (rel === "next") out.next = url;
    if (rel === "prev") out.prev = url;
  }
  return out;
}

async function safeText(res) { try { return await res.text(); } catch { return ""; } }
