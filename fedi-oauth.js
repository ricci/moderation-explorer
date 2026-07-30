// Client-side Mastodon OAuth (Authorization Code + PKCE), using oauth4webapi
// for the security-sensitive generic OAuth mechanics (PKCE verifier/challenge
// generation, CSRF state validation, and the token exchange).
//
// This page has no server component, so it can't keep a client_secret
// confidential in the traditional sense. Instead, it registers a fresh,
// throwaway OAuth application on the user's own instance for each login
// (via the public /api/v1/apps endpoint), then uses PKCE so that even
// though a client_secret is issued, possession of it alone isn't enough to
// redeem an authorization code - only this browser, holding the
// code_verifier, can complete the exchange. Everything here is a direct
// browser fetch to the user's home server; Mastodon's OAuth and apps
// endpoints are all CORS-enabled.

import * as oauth from "./vendor/oauth4webapi/oauth4webapi.js";

// read:accounts covers verify_credentials and followers/following;
// read:statuses covers the home timeline. Nothing else is needed.
const OAUTH_SCOPE = "read:accounts read:statuses";

// The keys that make up a completed connection, wherever it's stored.
const OAUTH_KEYS = ["oauth_server", "oauth_client_id", "oauth_client_secret", "oauth_access_token", "oauth_username", "oauth_redirect_uri"];

function oauthRedirectUri() {
  return location.origin + location.pathname;
}

function authServerFor(server) {
  return {
    issuer: `https://${server}`,
    authorization_endpoint: `https://${server}/oauth/authorize`,
    token_endpoint: `https://${server}/oauth/token`,
    revocation_endpoint: `https://${server}/oauth/revoke`,
  };
}

// getAccessToken() and oauthStore() are defined globally in helpers.js,
// since getAccessToken() is called from a classic script and must work
// even if this module fails to load. getAccessToken() (see helpers.js) is
// also gated on the username field still matching the connected account.
// rawAccessToken() below is the ungated version, for bookkeeping (is there
// a connection at all?) rather than deciding whether to actually use it.
function rawAccessToken() {
  return oauthStore().getItem("oauth_access_token") || "";
}

// Kicks off the OAuth flow: registers a temporary app on the user's
// server, then redirects the whole page there to ask for authorization.
async function startOAuth() {
  const errDiv = document.getElementById("errors");
  errDiv.style.display = "none";

  let acct, domain;
  try {
    [acct, domain] = splitUsername(document.getElementById("username").value);
  } catch (e) {
    errDiv.style.display = "block";
    errDiv.textContent = "Enter a Fediverse handle in @user@domain format before connecting";
    return;
  }

  const statusSpan = document.getElementById("oauthStatus");
  statusSpan.textContent = "Connecting…";

  try {
    const server = await resolveWebfingerHost(acct, domain);
    const redirectUri = oauthRedirectUri();

    const appResp = await fetch(`https://${server}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_name: document.title,
        redirect_uris: redirectUri,
        scopes: OAUTH_SCOPE,
        website: location.origin,
      }),
    });
    if (!appResp.ok) throw new Error("could not register with " + server);
    const app = await appResp.json();

    const codeVerifier = oauth.generateRandomCodeVerifier();
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
    const state = oauth.generateRandomState();

    // These are only needed for the redirect round-trip itself, so they
    // always go in sessionStorage regardless of the "remember me" choice -
    // handleOAuthRedirect() moves the final result to the right place after.
    sessionStorage.setItem("oauth_server", server);
    sessionStorage.setItem("oauth_client_id", app.client_id);
    sessionStorage.setItem("oauth_client_secret", app.client_secret);
    sessionStorage.setItem("oauth_verifier", codeVerifier);
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_username", document.getElementById("username").value);
    sessionStorage.setItem("oauth_redirect_uri", redirectUri);
    sessionStorage.setItem("oauth_remember", document.getElementById("oauthRemember").checked ? "1" : "0");

    const as = authServerFor(server);
    const authUrl = new URL(as.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", app.client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", OAUTH_SCOPE);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);

    location.href = authUrl.toString();
  } catch (e) {
    statusSpan.textContent = "";
    errDiv.style.display = "block";
    errDiv.textContent = "Could not start the connection to your server: " + e.message;
  }
}

// Runs on every page load. If we were just redirected back from an
// instance's authorization page, finish the flow by exchanging the code
// for an access token.
async function handleOAuthRedirect() {
  const currentUrl = new URL(location.href);
  if (!currentUrl.searchParams.get("code") && !currentUrl.searchParams.get("error")) return;

  const server = sessionStorage.getItem("oauth_server");
  const clientId = sessionStorage.getItem("oauth_client_id");
  const clientSecret = sessionStorage.getItem("oauth_client_secret");
  const codeVerifier = sessionStorage.getItem("oauth_verifier");
  const expectedState = sessionStorage.getItem("oauth_state");
  const redirectUri = sessionStorage.getItem("oauth_redirect_uri");
  const username = sessionStorage.getItem("oauth_username");
  const remember = sessionStorage.getItem("oauth_remember") === "1";

  // Always scrub the auth code/state and the round-trip bookkeeping out of
  // sessionStorage, whatever happens - on success, it gets rewritten below
  // into whichever store (session- or local-) the user actually asked for.
  history.replaceState({}, document.title, oauthRedirectUri());
  ["oauth_verifier", "oauth_state", "oauth_remember", ...OAUTH_KEYS]
    .forEach((k) => sessionStorage.removeItem(k));

  if (!server || !clientId || !clientSecret) return;

  const as = authServerFor(server);
  const client = { client_id: clientId };
  const clientAuth = oauth.ClientSecretPost(clientSecret);

  try {
    const params = oauth.validateAuthResponse(as, client, currentUrl, expectedState);

    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      clientAuth,
      params,
      redirectUri,
      codeVerifier
    );
    const result = await oauth.processAuthorizationCodeResponse(as, client, response);

    const store = remember ? localStorage : sessionStorage;
    store.setItem("oauth_server", server);
    store.setItem("oauth_client_id", clientId);
    store.setItem("oauth_client_secret", clientSecret);
    store.setItem("oauth_access_token", result.access_token);
    store.setItem("oauth_username", username);
    store.setItem("oauth_redirect_uri", redirectUri);

    if (username) document.getElementById("username").value = username;
    document.getElementById("advanced").style.display = "block";
  } catch (e) {
    document.getElementById("errors").style.display = "block";
    document.getElementById("errors").textContent = "Could not complete Mastodon login: " + e.message;
  } finally {
    updateOAuthStatus();
  }
}

async function disconnectOAuth() {
  const store = oauthStore();
  const server = store.getItem("oauth_server");
  const clientId = store.getItem("oauth_client_id");
  const clientSecret = store.getItem("oauth_client_secret");
  const token = store.getItem("oauth_access_token") || "";

  if (server && clientId && clientSecret && token) {
    try {
      const as = authServerFor(server);
      const client = { client_id: clientId };
      const clientAuth = oauth.ClientSecretPost(clientSecret);
      const response = await oauth.revocationRequest(as, client, clientAuth, token);
      await oauth.processRevocationResponse(response);
    } catch (e) {
      // Best effort - still forget the token locally either way.
    }
  }

  // Clear both storages unconditionally, regardless of which one was
  // actually in use - safer than assuming only one ever holds anything.
  OAUTH_KEYS.forEach((k) => { sessionStorage.removeItem(k); localStorage.removeItem(k); });

  updateOAuthStatus();
}

// Toggling "remember me" while already connected moves the existing
// connection between storages live, rather than only taking effect on the
// next login.
function handleRememberToggle() {
  if (document.getElementById("oauthRemember").checked) {
    promoteToLocalStorage();
  } else {
    demoteToSessionStorage();
  }
  updateOAuthStatus();
}

// Checking the box: only drop the sessionStorage copy once it's safely
// copied to localStorage, so a failed write (e.g. storage full, private
// browsing) doesn't lose the connection entirely.
function promoteToLocalStorage() {
  if (!sessionStorage.getItem("oauth_access_token")) return;
  try {
    OAUTH_KEYS.forEach((k) => {
      const v = sessionStorage.getItem(k);
      if (v !== null) localStorage.setItem(k, v);
    });
  } catch (e) {
    return;
  }
  OAUTH_KEYS.forEach((k) => sessionStorage.removeItem(k));
}

// Unchecking the box: the whole point is to guarantee nothing's left in
// long-term storage, so localStorage always gets cleared - even if copying
// back to sessionStorage runs into trouble for some reason.
function demoteToSessionStorage() {
  if (!localStorage.getItem("oauth_access_token")) return;
  try {
    OAUTH_KEYS.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v !== null) sessionStorage.setItem(k, v);
    });
  } finally {
    OAUTH_KEYS.forEach((k) => localStorage.removeItem(k));
  }
}

function updateOAuthStatus() {
  const statusSpan = document.getElementById("oauthStatus");
  const staleNote = document.getElementById("oauthStale");
  const connectButton = document.getElementById("oauthConnect");
  const disconnectButton = document.getElementById("oauthDisconnect");
  const rememberCheckbox = document.getElementById("oauthRemember");
  const connectedUsername = oauthStore().getItem("oauth_username");

  if (rawAccessToken() && connectedUsername) {
    const stale = document.getElementById("username").value !== connectedUsername;
    const opacity = stale ? "0.5" : "1";
    statusSpan.textContent = "Connected as " + connectedUsername;
    statusSpan.style.opacity = opacity;
    staleNote.style.display = stale ? "inline" : "none";
    staleNote.style.opacity = opacity;
    connectButton.style.display = "none";
    // Reflect (rather than drive) which store the connection is actually in -
    // this doesn't fire "change", so it won't trigger handleRememberToggle().
    rememberCheckbox.checked = oauthStore() === localStorage;
    disconnectButton.style.display = "inline";
  } else {
    statusSpan.textContent = "";
    statusSpan.style.opacity = "1";
    staleNote.style.display = "none";
    connectButton.style.display = "inline";
    disconnectButton.style.display = "none";
  }
}

// Inline onclick="" handlers in index.html need these on the global object,
// since module scripts don't otherwise leak declarations into global scope.
// This also overwrites the file://-safe fallbacks defined in helpers.js.
window.startOAuth = startOAuth;
window.disconnectOAuth = disconnectOAuth;

document.addEventListener("DOMContentLoaded", async () => {
  await handleOAuthRedirect();

  // If we're still connected - this tab's session, or a remembered
  // localStorage connection - restore the username field and open advanced
  // mode, so it's clear we're still connected rather than leaving that
  // discovery for a later click.
  const connectedUsername = oauthStore().getItem("oauth_username");
  if (rawAccessToken() && connectedUsername) {
    document.getElementById("username").value = connectedUsername;
    document.getElementById("advanced").style.display = "block";
  }

  updateOAuthStatus();
  document.getElementById("username").addEventListener("input", updateOAuthStatus);
  document.getElementById("oauthRemember").addEventListener("change", handleRememberToggle);
});
