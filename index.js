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

    settext("mau",instance.instance.usage.users.active_month ? instance.instance.usage.users.active_month : "not public"); + instance.instance.domain
    settext("weeklyposts",instance.activity? instance.activity[0].statuses : "not public");
    settext("peers",instance.peers? instance.peers.length : "not public");
    settext("blockedservers",instance.blocks? instance.blocks.length : "not public");

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
      settext("followercount",followers.length);
      accts = extract_accts(followers);
      hist = instance_histogram(accts);

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
      settext("followcount",follows.length);
      accts = extract_accts(follows);
      hist = instance_histogram(accts);

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
    }
    setvisible("following");
}


function startLoading(what) {
    elem = document.getElementById(what);
    elem.style.display = "block";
}

function stopLoading(what) {
    elem = document.getElementById(what);
    elem.style.display = "none";
}


async function getAccount(id) {
  errDiv = document.getElementById("errors");
  errDiv.style.display = "none";
  try {
    [acct, server] = splitUsername(id);
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = error;
    return;
  }

  startLoading("loadingAccount");
  try {
    const url = "https://" + server + SEARCH_ENDPOINT + '?type=accounts&resolve=false&limit=1&q=' + id;
    const response = await fetch(url);
    const result = await response.json();
    const account = result.accounts[0];
    var accountId = account.id;
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = "Error fetching account";
    return;
  }
  stopLoading("loadingAccount");

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
  startLoading("loadingServer");
  for (const [name,endpoint] of endpoints) {
      try {
          const url = "https://" + server + endpoint;
          const response = await fetch(url);
          instance[name] = await response.json();
      } catch {
          // We let these go, because some servers reject certain endpoints
      }
  }
  stopLoading("loadingServer");


  populateInstance(instance);

  const baseUrl = "https://" + server;

  try {
    startLoading("loadingFollowers");
    var followers = await fetchAllFollowers({baseUrl, accountId});
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = "Can't fetch followers: " + error;
    return;
  } finally {
    stopLoading("loadingFollowers");
  }
  populateFollowers(followers,server);

  try {
    startLoading("loadingFollows");
    var following = await fetchAllFollowing({baseUrl, accountId});
  } catch (error) {
    errDiv.style.display = "block";
    errDiv.textContent = "Can't fetch following: " + error;
    return;
  } finally {
    stopLoading("loadingFollows");
  }
  populateFollowing(following,server);
  document.getElementById("coda").style.display = "block";

}
