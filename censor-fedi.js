var SEARCH_ENDPOINT = "/api/v2/search";
var ACCOUNT_ENDPOINT = "/api/v1/accounts/";

async function fetchAccountRelation({
  baseUrl,
  accountId,
  relation = "followers",
  token,
  limit = 80,
  maxPages = Infinity,
  onPage,
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
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

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

function splitUsername (username) {
  // TODO: Error checking
  const parts = username.split('@');
  return [parts[1], parts[2]];

}

function populateProfile(a,username) {
    const div = document.getElementById("userbox");
    const img = document.createElement("img");
    img.setAttribute("src",a.avatar);
    div.append(img);

    var name = document.createElement("span");
    name.setAttribute("class","displayname");
    name.textContent = a.display_name;
    div.append(name);

    var username = document.createElement("span");
    username.setAttribute("class","username");
    username.textContent = username;
    div.append(username);

    var following = document.createElement("span");
    following.setAttribute("class", "following");
    following.textContent = "Following: " + a.following_count;
    div.append(following);

    var followers = document.createElement("span");
    followers.setAttribute("class", "followers");
    followers.textContent = "Followers: " + a.followers_count;
    div.append(followers);
}

function startLoading(what) {
    elem = document.getElementById("loading");
    document.getElementById("loadingwhat").textContent = what;
    elem.style.visibility = "visible";
}

function stopLoading(what) {
    elem = document.getElementById("loading");
    elem.style.visibility = "hidden";
}


async function getAccount(id,target) {
  console.log(id);
  try {
    [acct, server] = splitUsername(id);


    startLoading("account");
    // TODO need a way to make sure it's only search the account field, not description etc.
    const url = "https://" + server + SEARCH_ENDPOINT + '?type=accounts&resolve=false&limit=1&q=' + id;
    const response = await fetch(url);
    const result = await response.json();
    stopLoading();

    document.getElementById(target).textContent = JSON.stringify(result,null,4);
    // TODO: Error checking
    const account = result.accounts[0];
    const accountId = account.id;

    populateProfile(account,id);

    const baseUrl = "https://" + server;

    startLoading("followers");
    const followers = await fetchAllFollowers({baseUrl, accountId});
    stopLoading();
    console.log(followers);

    startLoading("following");
    const following = await fetchAllFollowing({baseUrl, accountId});
    stopLoading();
    console.log(following);

  } catch (error) {
    // TODO: Error checking
    console.error(error.message);
  }
}
