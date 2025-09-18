function populateUser() {
    setvisible("you");
}

function populateInstance(instance) {

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

    settext("mau",instance.instance.usage.users.active_month ? addCommas(instance.instance.usage.users.active_month) : "not public"); + instance.instance.domain
    settext("weeklyposts",instance.activity? addCommas(instance.activity[1].statuses) : "not public");
    settext("peers",instance.peers? addCommas(instance.peers.length) : "not public");
    settext("blockedservers",instance.blocks? addCommas(instance.blocks.length) : "not public");

    settext("regstatus",instance.instance.registrations.enabled? "enabled" : "disabled");

    setvisible("instanceblock");
}


function populateFollowers(followers,instance) {
    if (followers.length == 0) {
      const fBody = document.getElementById("followersBody");
      const fNone = document.getElementById("followersNone");
      fBody.style.display = "none";
      fNone.style.display = "block";
    } else {
      settext("followercount",addCommas(followers.length));
      accts = extract_accts(followers);
      hist = instance_histogram(accts);

      settext("followerservers",addCommas(hist.size));

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
          td1.textContent = addCommas(value);
          let td2 = document.createElement("td");
          td2.textContent = (value * 100 / followers.length).toFixed(1) + " %";
          tr.append(th,td1,td2);
          tbody.appendChild(tr);
          count++;
          if (count >= 10) break;
      }
    }
    setvisible("followers");
}

function populateFollowing(follows,instance) {
    if (follows.length == 0) {
      const fBody = document.getElementById("followingBody");
      const fNone = document.getElementById("followingNone");
      fBody.style.display = "none";
      fNone.style.display = "block";
    } else {
      settext("followcount",addCommas(follows.length));
      accts = extract_accts(follows);
      hist = instance_histogram(accts);

      settext("followservers",addCommas(hist.size));

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
          td1.textContent = addCommas(value);
          let td2 = document.createElement("td");
          td2.textContent = (value * 100 / follows.length).toFixed(1) + " %";
          tr.append(th,td1,td2);
          tbody.appendChild(tr);
          count++;
          if (count >= 10) break;
      }
    }
    setvisible("following");
}


function startLoading(what) {
    document.getElementById("loadWhat").textContent = what;
    document.getElementById("loading").style.display = "block";
}

function stopLoading() {
    document.getElementById("loading").style.display = "none";
}


async function getAccount(id,token) {
  headers = {};
  if (token) {
        headers["Authorization"] = "Bearer " + token;
  }
  errDiv = document.getElementById("errors");
  errDiv.style.display = "none";
  try {
    [acct, domain] = splitUsername(id);
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = "Enter a Fediverse handle in @user@domain format"
    return;
  }

  // Check for webfinger to see if the actual API is somewhere else
  startLoading("Webfinger");
  const server = await resolveWebfingerHost(domain);
  stopLoading();


  if (token) {
      startLoading("Authorization");
      try {
        const url = "https://" + server + VERIFY_ENDPOINT;
        const response = await fetch(url, {headers});
        if (!response.ok) { throw new Error(); }
      } catch (error) {
        errDiv.style.display = "block";
        errDiv.textContent = "Check of authorization token failed";
        return;
      } finally {
          stopLoading();
      }
  }
  startLoading("Account");
  try {
    const url = "https://" + server + SEARCH_ENDPOINT + '?type=accounts&resolve=false&limit=1&q=' + id;
    const response = await fetch(url, {headers});
    const result = await response.json();
    const account = result.accounts[0];
    var accountId = account.id;
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = "Error fetching account (note: only Mastodon accounts supported for now)";
    return;
  } finally {
      stopLoading();
  }

  // If we got this far we'll hide the search box
  document.getElementById("inputform").style.display = "none";

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
      startLoading("Server " + name);
      try {
          const url = "https://" + server + endpoint;
          const response = await fetch(url,{headers});
          instance[name] = await response.json();
      } catch {
          // We let these go, because some servers reject certain endpoints
      }
      stopLoading();
  }


  populateInstance(instance);

  const baseUrl = "https://" + server;

  try {
    startLoading("Followers");
    var followers = await fetchAllFollowers({baseUrl, accountId, token});
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = "Can't fetch followers: " + error;
    return;
  } finally {
    stopLoading();
  }
  populateFollowers(followers,domain);

  try {
    startLoading("Follows");
    var following = await fetchAllFollowing({baseUrl, accountId, token});
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = "Can't fetch following: " + error;
    return;
  } finally {
    stopLoading();
  }
  populateFollowing(following,domain);
  document.getElementById("coda").style.display = "block";

}
