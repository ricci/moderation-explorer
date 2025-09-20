function toggleAdvanced() {
    let e = document.getElementById('advanced')
    if (e.style.display=='block') {
        e.style.display='none';
    } else {
        e.style.display='block';
    }
    return 0;
}

function populateUser() {
    setvisible("you");
}

function reset() {
    // Make everything invisible again
    var resetme = document.getElementsByClassName('resetInvis');
    for (i=0; i< resetme.length; i++){
        console.log("resetInvis");
        resetme.item(i).style.display = "none";
    }
    // Remove contents of table bodies
    var tbodies = document.getElementsByClassName('resetClear');
    for (i=0; i< tbodies.length; i++){
        console.log("resetBody");
        tbodies.item(i).textContent =  '';
    }
}

function populateInstance(instance) {

    const instancelink = document.getElementById("instancelink");
    instancelink.setAttribute("href","https://" + instance.instance.domain)
    instancelink.textContent = instance.instance.title;

    if (instance.instance.domain == "discuss.systems") {
        document.getElementById("thumbnail").style.display="inline-block";
        document.getElementById("thumbnail").src = "img/miso.png";
    } else if (instance.instance.thumbnail) {
        document.getElementById("thumbnail").style.display="inline-block";
        document.getElementById("thumbnail").src = instance.instance.thumbnail.url;
    }

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
    const fBody = document.getElementById("followersBody");
    const fNone = document.getElementById("followersNone");
    if (followers.length == 0) {
      fBody.style.display = "none";
      fNone.style.display = "block";
    } else {
      fBody.style.display = "flex";
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
    return hist;
}

function populateFollowing(follows,instance) {
    const fBody = document.getElementById("followingBody");
    const fNone = document.getElementById("followingNone");
    if (follows.length == 0) {
      fBody.style.display = "none";
      fNone.style.display = "block";
    } else {
      fBody.style.display = "flex";
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
    return hist;
}

function populateComparison(followers,followers_hist,follows,follows_hist,instance) {

    const tbody = document.getElementById("comparisonfollowersbody");
    var count = 0;
    for (let [key, value] of followers_hist) {
        if (!key) {
            key = instance;
        }
        let tr = document.createElement("tr");
        let th = document.createElement("th");
        th.textContent = key;
        let td1 = document.createElement("td");
        td1.textContent = (value * 100 / followers.length).toFixed(1) + " %";
        let td2 = document.createElement("td");
        td2.textContent = (domain_percentages[key]?domain_percentages[key].Users.toFixed(3) : "--") + " %";
        tr.append(th,td1,td2);
        tbody.appendChild(tr);
        count++;
        if (count >= 10) break;
    }

    const tFbody = document.getElementById("comparisonfollowingbody");
    var count = 0;
    for (let [key, value] of follows_hist) {
        if (!key) {
            key = instance;
        }
        let tr = document.createElement("tr");
        let th = document.createElement("th");
        th.textContent = key;
        let td1 = document.createElement("td");
        td1.textContent = (value * 100 / follows.length).toFixed(1) + " %";
        let td2 = document.createElement("td");
        td2.textContent = (domain_percentages[key]?domain_percentages[key].Users.toFixed(3) : "--") + " %";
        tr.append(th,td1,td2);
        tFbody.appendChild(tr);
        count++;
        if (count >= 10) break;
    }
    setvisible("comparison");
}

function populateTimeline(posts, instance) {
    const pBody = document.getElementById("timelineBody");
    const pNone = document.getElementById("timelineNone");
    if (posts.length == 0) {
      pBody.style.display = "none";
      pNone.style.display = "block";
    } else {
      pBody.style.display = "flex";
      settext("timelinePostCount",addCommas(posts.length));
      const accts = extract_accts_posts(posts);

      const accountN = new Set(accts).size;
      settext("timelineAccountCount",addCommas(accountN));

      hist = instance_histogram(accts);

      settext("timelineServers",addCommas(hist.size));

      const tbody = document.getElementById("timelinebody");
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
          td2.textContent = (value * 100 / posts.length).toFixed(1) + " %";
          let td3 = document.createElement("td");
          td3.textContent = (domain_percentages[key]?domain_percentages[key].Users.toFixed(3) : "--") + " %";
          tr.append(th,td1,td2,td3);
          tbody.appendChild(tr);
          count++;
          if (count >= 10) break;
      }

      const OPaccts = extract_accts_op(posts);
      const OPhist = account_histogram(OPaccts);
      const OPaccountN = OPhist.size;
      settext("timelineOPCount",addCommas(OPaccountN));
      const OPtbody = document.getElementById("timelineTopPosterBody");
      var count = 0;
      for (let [key, value] of OPhist) {
          let tr = document.createElement("tr");
          let th = document.createElement("th");
          th.textContent = "@"+ key + (key.includes("@") ? "" : ("@" + instance) );
          let td1 = document.createElement("td");
          td1.textContent = addCommas(value);
          let td2 = document.createElement("td");
          td2.textContent = (value * 100 / posts.length).toFixed(1) + " %";
          tr.append(th,td1,td2);
          OPtbody.appendChild(tr);
          count++;
          if (count >= 10) break;
      }

      const Baccts = extract_accts_boosters(posts);
      const Bhist = account_histogram(Baccts);
      var BaccountN = Bhist.size;
      settext("timelineBoosterCount",addCommas(BaccountN));
      const Btbody = document.getElementById("timelineTopBoosterBody");
      var count = 0;
      for (let [key, value] of Bhist) {
          let tr = document.createElement("tr");
          let th = document.createElement("th");
          th.textContent = "@"+ key + (key.includes("@") ? "" : ("@" + instance) );
          let td1 = document.createElement("td");
          td1.textContent = addCommas(value);
          let td2 = document.createElement("td");
          td2.textContent = (value * 100 / posts.length).toFixed(1) + " %";
          tr.append(th,td1,td2);
          Btbody.appendChild(tr);
          count++;
          if (count >= 10) break;
      }
    }
    setvisible("timeline");
}


function startLoading(what) {
    document.getElementById("loadWhat").textContent = what;
    document.getElementById("loading").style.display = "block";
}

function stopLoading() {
    document.getElementById("loading").style.display = "none";
}

// Wrapper so that we can disable the button and re-enable it the 
// main function exits for any reasons
async function populatePage(id,token) {
    document.getElementById("submit").disabled = true;
    await getAccount(id,token);
    document.getElementById("submit").disabled = false;
}

async function getAccount(id,token) {
  // Clear out everything in case we were displaying a previous user
  reset();

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
  const followers_hist = populateFollowers(followers,domain);

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
  const following_hist = populateFollowing(following,domain);

  if (followers.length > 0 || following.length > 0) {
    populateComparison(followers,followers_hist,following,following_hist,domain);
  }

  if (token) {
    try {
      startLoading("Timeline");
      var posts = await fetchLastNHoursStatuses(baseUrl, token, 24);
    } catch (error) {
      errDiv.style.display = "block";
      errDiv.textContent = "Can't fetch timeline: " + error;
      return;
    } finally {
      stopLoading();
    }
    populateTimeline(posts,domain);
  }

  document.getElementById("coda").style.display = "block";

}
