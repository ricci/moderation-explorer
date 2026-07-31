function settext(id,content) {
    document.getElementById(id).textContent = content;
}

function setvisible(id) {
    document.getElementById(id).style.display = "block";
}

function extract_accts(list) {
    var accts = [];
    list.forEach((e) => accts.push(e.acct));
    return accts;
}

function extract_accts_posts(list) {
    var accts = [];
    list.forEach((e) => accts.push(e.account.acct));
    return accts;
}

function extract_accts_op(list) {
    var accts = [];
    list.forEach((e) => {if (!e.reblog) {accts.push(e.account.acct)}});
    return accts;
}

function extract_accts_boosters(list) {
    var accts = [];
    list.forEach((e) => {if (e.reblog) {accts.push(e.account.acct)}});
    return accts;
}


function instance_histogram(account_list) {
    var map = new Map();
    account_list.forEach((e) => {
        const parts = e.split('@');
        instance = parts[1];
        if (!map.has(instance)) {
            map.set(instance,1)
        } else {
            map.set(instance,map.get(instance) + 1)
        }
    })
    return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}

function account_histogram(account_list) {
    var map = new Map();
    account_list.forEach((e) => {
        if (!map.has(e)) {
            map.set(e,1)
        } else {
            map.set(e,map.get(e) + 1)
        }
    })
    return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}


function addCommas(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// OAuth connection state normally lives in sessionStorage (forgotten when
// the tab closes). If the user opted in to "remember me on this device", it
// lives in localStorage instead (kept until they Disconnect). Whichever one
// actually has a token is the one in use.
function oauthStore() {
    return localStorage.getItem("oauth_access_token") ? localStorage : sessionStorage;
}

// Fallbacks in case fedi-oauth.js (an ES module) fails to load, e.g. when
// opened via file:// - keeps the non-OAuth part of the tool working.
// startOAuth/disconnectOAuth get replaced with the real versions on success.
// The stored token is only good for the handle we connected with - if the
// username field has since been changed, quietly stop offering it rather
// than sending it along with (or trying to authenticate) a different account.
function getAccessToken() {
    const store = oauthStore();
    const boundUsername = store.getItem("oauth_username");
    if (boundUsername && boundUsername !== document.getElementById("username").value) {
        return "";
    }
    return store.getItem("oauth_access_token") || "";
}

function startOAuth() {
    const errDiv = document.getElementById("errors");
    errDiv.style.display = "block";
    errDiv.textContent = "Sorry, connecting to Mastodon isn't available right now. You can still use the tool without logging in.";
}

function disconnectOAuth() {}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("submit").addEventListener("click", () =>
        populatePage(document.getElementById("username").value, getAccessToken()));
    document.getElementById("advancedToggle").addEventListener("click", () => toggleAdvanced());
    document.getElementById("oauthConnect").addEventListener("click", () => startOAuth());
    document.getElementById("oauthDisconnect").addEventListener("click", () => disconnectOAuth());
});

