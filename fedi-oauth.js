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

// getAccessToken() is defined globally in helpers.js, since it's called
// from a classic script and must work even if this module fails to load.

function getOAuthServer() {
  return sessionStorage.getItem("oauth_server") || "";
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

    sessionStorage.setItem("oauth_server", server);
    sessionStorage.setItem("oauth_client_id", app.client_id);
    sessionStorage.setItem("oauth_client_secret", app.client_secret);
    sessionStorage.setItem("oauth_verifier", codeVerifier);
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_username", document.getElementById("username").value);
    sessionStorage.setItem("oauth_redirect_uri", redirectUri);

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

  // Always scrub the auth code/state out of the URL, whatever happens.
  history.replaceState({}, document.title, oauthRedirectUri());
  sessionStorage.removeItem("oauth_verifier");
  sessionStorage.removeItem("oauth_state");

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

    sessionStorage.setItem("oauth_access_token", result.access_token);

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
  const server = getOAuthServer();
  const clientId = sessionStorage.getItem("oauth_client_id");
  const clientSecret = sessionStorage.getItem("oauth_client_secret");
  const token = getAccessToken();

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

  ["oauth_server", "oauth_client_id", "oauth_client_secret", "oauth_access_token", "oauth_username", "oauth_redirect_uri"]
    .forEach((k) => sessionStorage.removeItem(k));

  updateOAuthStatus();
}

function updateOAuthStatus() {
  const statusSpan = document.getElementById("oauthStatus");
  const connectButton = document.getElementById("oauthConnect");
  const disconnectButton = document.getElementById("oauthDisconnect");
  const server = getOAuthServer();

  if (getAccessToken() && server) {
    statusSpan.textContent = "Connected to " + server;
    connectButton.style.display = "none";
    disconnectButton.style.display = "inline";
  } else {
    statusSpan.textContent = "";
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
  updateOAuthStatus();
});
