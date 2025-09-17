const SEARCH_ENDPOINT = "/api/v2/search";
const ACCOUNT_ENDPOINT = "/api/v1/accounts/";

const INSTANCE_ENDPOINT = "/api/v2/instance";
const PEERS_ENDPOINT = "/api/v1/instance/peers";
const ACTIVITY_ENDPOINT = "/api/v1/instance/activity";
const RULES_ENDPOINT = "/api/v1/instance/rules";
const BLOCKS_ENDPOINT = "/api/v1/instance/domain_blocks";


function splitUsername (username) {
  // TODO: Error checking
  const parts = username.split('@');
  return [parts[1], parts[2]];

}

function settext(id,content) {
    document.getElementById(id).textContent = content;
}

function setvisible(id) {
    document.getElementById(id).style.display = "block";
}

function populateUser() {
    setvisible("you");
}

function p(item) {
    if (! item) {
        return "not public"
    } else {
        return item;
    }
}

function populateInstance(instance) {

    console.log(instance);

    const instancelink = document.getElementById("instancelink");
    instancelink.setAttribute("href","https://" + instance.instance.domain)
    instancelink.textContent = instance.instance.title;

    if (instance.instance.configuration.urls.about) {
        const aboutlink = document.getElementById("aboutlink");
        aboutlink.setAttribute("href",instance.instance.configuration.urls.about)
        aboutlink.textContent = "About" + (instance.rules? "/Rules" : "");
    }

    if (instance.instance.configuration.urls.privacy_policy) {
        const privlink = document.getElementById("privlink");
        privlink.setAttribute("href",instance.instance.configuration.urls.privacy_policy)
        privlink.textContent = "Privacy Policy";
    }

    if (instance.instance.configuration.urls.terms_of_service) {
        const toslink = document.getElementById("toslink");
        toslink.setAttribute("href",instance.instance.configuration.urls.terms_of_service)
        toslink.textContent = "Terms of Service";
    }


    const adminacct = document.getElementById("adminacct");
    const adminlink = document.createElement("a");
    adminlink.setAttribute("href",instance.instance.contact.account.url);
    adminlink.textContent = "@" + instance.instance.contact.account.username + "@" + instance.instance.domain;
    adminacct.replaceChildren(adminlink);

    const adminemail = document.getElementById("adminemail");
    const adminemaillink = document.createElement("a");
    adminemaillink.setAttribute("href","mailto:" + instance.instance.contact.email);
    adminemaillink.textContent = instance.instance.contact.email;
    adminemail.replaceChildren(adminemaillink);

    settext("mau",p(instance.instance.usage.users.active_month)); + instance.instance.domain
    settext("weeklyposts",instance.activity? instance.activity[0].statuses : "not public");
    settext("peers",instance.peers? instance.peers.length : "not public");
    settext("blockedservers",instance.blocks? instance.blocks.length : "not public");

    settext("regstatus",instance.instance.registrations.enabled? "enabled" : "disabled");

    setvisible("instanceblock");
}

function populateProfile(a,username,instance) {
    const div = document.getElementById("instanceblock");
    document.getElementById("instance").textContent = instance;
    div.style.display = "block";
    /*
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
    */
}

function extract_accts(list) {
    var accts = [];
    list.forEach((e) => accts.push(e.acct));
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

function populateFollowers(followers,instance) {
    settext("followercount",followers.length);
    accts = extract_accts(followers);
    console.log(accts);
    hist = instance_histogram(accts);
    console.log(hist);

    settext("followerservers",hist.size);

    const tbody = document.getElementById("followerbody");
    var count = 0;
    for (let [key, value] of hist) {
        if (!key) {
            key = instance;
        }
        let tr = document.createElement("tr");
        let th = document.createElement("th");
        th.textContent = key;
        let td1 = document.createElement("td");
        td1.textContent = value;
        let td2 = document.createElement("td");
        td2.textContent = (value * 100 / followers.length).toFixed(1) + " %";
        tr.append(th,td1,td2);
        tbody.appendChild(tr);
        count++;
        if (count >= 10) break;
    }
    setvisible("followers");
}

function populateFollowing(follows,instance) {
    settext("followcount",follows.length);
    accts = extract_accts(follows);
    console.log(accts);
    hist = instance_histogram(accts);
    console.log(hist);

    settext("followservers",hist.size);

    const tbody = document.getElementById("followbody");
    var count = 0;
    for (let [key, value] of hist) {
        if (!key) {
            key = instance;
        }
        let tr = document.createElement("tr");
        let th = document.createElement("th");
        th.textContent = key;
        let td1 = document.createElement("td");
        td1.textContent = value;
        let td2 = document.createElement("td");
        td2.textContent = (value * 100 / follows.length).toFixed(1) + " %";
        tr.append(th,td1,td2);
        tbody.appendChild(tr);
        count++;
        if (count >= 10) break;
    }
    setvisible("following");
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
  [acct, server] = splitUsername(id);
  try {


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
    populateUser();

    const endpoints = [
        ["instance", INSTANCE_ENDPOINT],
        ["peers", PEERS_ENDPOINT],
        ["activity", ACTIVITY_ENDPOINT],
        ["rules", RULES_ENDPOINT],
        ["blocks", BLOCKS_ENDPOINT]
    ];

    const instance = {};
    for (const [name,endpoint] of endpoints) {
        startLoading(name);
        try {
            const url = "https://" + server + endpoint;
            const response = await fetch(url);
            instance[name] = await response.json();
        } catch {
        }
        stopLoading(name);
    }


    populateInstance(instance);

    const baseUrl = "https://" + server;

    startLoading("followers");
    const followers = await fetchAllFollowers({baseUrl, accountId});
    stopLoading();
    console.log(followers);
    populateFollowers(followers,server);

    startLoading("following");
    const following = await fetchAllFollowing({baseUrl, accountId});
    stopLoading();
    console.log(following);
    populateFollowing(following,server);

  } catch (error) {
    // TODO: Error checking
    console.error(error.message);
  }
}
