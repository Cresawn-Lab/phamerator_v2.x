import { TMDomains } from "/imports/api/collections";
import { TRNAs } from "/imports/api/collections";
import { Datasets } from "/imports/api/collections";
import { Genomes } from "/imports/api/collections";
import { Phams } from "/imports/api/collections";
import { Domains } from "/imports/api/collections";
import { Genes } from "/imports/api/collections";
import { Proteins } from "/imports/api/collections";
import { check, Match } from "meteor/check";
import crypto from 'crypto';

Meteor.methods({
  "generateApiKey": async function () {
    if (!this.userId) throw new Meteor.Error('401', 'Not logged in');

    // Create a base-36 string that contains 30 chars in a-z,0-9
    const apiKey = [...Array(30)]
      .map((e) => ((Math.random() * 36) | 0).toString(36))
      .join('');

    // Hash the key for secure storage
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Set the apikey array. Note: replacing existing keys since only 1 key is supported.
    await Meteor.users.updateAsync(
      { _id: this.userId },
      { $set: { "apiKeys": [{ name: "default", key: hashedKey, lastUsed: new Date() }] } }
    );

    // Return the plaintext key only once to the user
    return apiKey;
  },
  "deleteApiKey": async function () {
    if (!this.userId) throw new Meteor.Error('401', 'Not logged in');

    await Meteor.users.updateAsync(
      { _id: this.userId },
      { $unset: { "apiKeys": "" } }
    );
  },
  "userExists": async function (username) {
    check(username, String);
    return !!await Meteor.users.findOneAsync({
      username: username
    });
  },
  "addUserToRole": async function (user, role, group) {
    check(user, Match.OneOf(String, Object));
    check(role, String);
    check(group, String);
    if (!this.userId) throw new Meteor.Error('401', 'Not logged in');
    const isOwner = await Roles.userIsInRoleAsync(this.userId, 'owner', group);
    if (!isOwner) throw new Meteor.Error('403', 'Not authorized: You must be an owner of this dataset.');

    await Roles.addUsersToRolesAsync(user, role, group);
    var key = "selectedData." + group;
    var projection = { key: { genomeMaps: [] } }
    await Meteor.users.updateAsync({ _id: user }, { $set: projection })
  },
  "removeUserFromRole": async function (user, role, group) {
    check(user, Match.OneOf(String, Object));
    check(role, String);
    check(group, String);
    if (!this.userId) throw new Meteor.Error('401', 'Not logged in');
    const isOwner = await Roles.userIsInRoleAsync(this.userId, 'owner', group);
    if (!isOwner) throw new Meteor.Error('403', 'Not authorized: You must be an owner of this dataset.');

    await Roles.removeUsersFromRolesAsync(user, role, group);
    await Meteor.users.updateAsync({ _id: user }, { $set: { "preferredDataset": "" } })
  },
  "getUsersInRole": async function (role, group) {
    check(role, String);
    check(group, String);
    if (!this.userId) throw new Meteor.Error('401', 'Not logged in');
    const isOwner = await Roles.userIsInRoleAsync(this.userId, 'owner', group);
    if (!isOwner) throw new Meteor.Error('403', 'Not authorized: You must be an owner of this dataset.');

    var cursor = await Roles.getUsersInRoleAsync(role, group);
    return await cursor.fetchAsync();
  },
  "getDatasetsIView": async function () {
    if (!Meteor.userId()) return [];
    const scopes = await Roles.getScopesForUserAsync(Meteor.userId(), "view");

    // Fetch all public datasets
    const publicDatasets = await Datasets.find({ public: true }, { fields: { name: 1 } }).fetchAsync();
    const publicNames = publicDatasets.map(d => d.name);

    // Combine scopes with public datasets and return unique set
    return [...new Set([...scopes, ...publicNames])];
  },
  "getDatasetsIOwn": async function () {
    return await Roles.getScopesForUserAsync(Meteor.userId(), "owner")
  },
  "updatePreferredDataset": async function (dataset) {
    check(dataset, String);
    if (!Meteor.userId()) return;

    // Is the dataset explicitly in their view scopes?
    let groups = await Roles.getScopesForUserAsync(Meteor.userId(), "view");
    if (groups.includes(dataset)) {
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { "preferredDataset": dataset } });
      return;
    }

    // Is the dataset marked as globally public?
    const d = await Datasets.findOneAsync({ name: dataset, public: true });
    if (d) {
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { "preferredDataset": dataset } });
      return;
    }
  },

  "updateSelectedData": async function (message, dataset, phagename, addGenome) {
    check(dataset, String);
    check(phagename, String);
    check(addGenome, Match.Maybe(Boolean));
    if (!Meteor.userId()) return;

    const userDoc = await Meteor.users.findOneAsync({ _id: Meteor.userId() }, { fields: { selectedData: 1 } });
    let selectedData = userDoc?.selectedData || {};
    if (!selectedData[dataset]) {
      selectedData[dataset] = { genomeMaps: [] };
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
    }
    const userDoc2 = await Meteor.users.findOneAsync({ _id: Meteor.userId() }, { fields: { selectedData: 1 } });
    let genomeMaps = userDoc2?.selectedData?.[dataset]?.genomeMaps || [];

    if (phagename === "") {
      selectedData[dataset] = { genomeMaps: [] };
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
    }

    else if (addGenome === true && genomeMaps.indexOf(phagename) === -1) {
      genomeMaps.push(phagename);
      selectedData[dataset] = { genomeMaps: genomeMaps };
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
    }
    else if (addGenome === false) {
      var index = genomeMaps.indexOf(phagename);
      if (index > -1) {
        genomeMaps.splice(index, 1);
        selectedData[dataset] = { genomeMaps: genomeMaps };
        await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
      }
    }
  },
  "updateSubclusterFavorites": async function (dataset, subcluster, addFavorite) {
    check(dataset, String);
    check(subcluster, Match.OneOf(String, Number));
    check(addFavorite, Boolean);
    if (!Meteor.userId()) return;

    // initialize selectedData.subclusterFavorites if it doesn't exist
    await Meteor.users.updateAsync({ _id: Meteor.userId(), 'selectedData.dataset.subclusterFavorites': { $exists: false } }, { $set: { 'selectedData.dataset.subclusterFavorites': [] } });
    const userDoc = await Meteor.users.findOneAsync({ _id: Meteor.userId() }, { fields: { "selectedData.dataset.subclusterFavorites": 1 } });
    let favorites = userDoc?.selectedData?.dataset?.subclusterFavorites || [];

    if (addFavorite === true && favorites.indexOf(subcluster) === -1) {
      favorites.push(subcluster);
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { "selectedData.dataset.subclusterFavorites": favorites } });
    }
    else if (addFavorite === false && favorites.indexOf(subcluster) !== -1) {
      var index = favorites.indexOf(subcluster);
      if (index > -1) {
        favorites.splice(index, 1);
        await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { "selectedData.dataset.subclusterFavorites": favorites } });
      }
    }
  },

  "updateNewTermsAndPolicies": async function () {
    if (!Meteor.userId()) return;
    // initialize selectedData.featureDiscovery if it doesn't exist
    await Meteor.users.updateAsync({ _id: Meteor.userId() }, { $set: { 'newTermsAndPolicies': false } });
  },
  sendVerificationLink() {
    let userId = Meteor.userId();
    if (userId) {
      return Accounts.sendVerificationEmail(userId);
    }
  },

  "getphams": async function (currentDataset) {
    check(currentDataset, String);
    if (!Meteor.userId()) return [];

    let allowed = false;
    const scopes = await Roles.getScopesForUserAsync(Meteor.userId(), "view");
    if (scopes.includes(currentDataset)) {
      allowed = true;
    } else {
      const d = await Datasets.findOneAsync({ name: currentDataset, public: true });
      if (d) allowed = true;
    }

    if (!allowed) return [];

    let phams = await Phams.find({ dataset: currentDataset }).fetchAsync();

    // Fallback: If no phams found in Phams collection, compute them from Genomes
    if (!phams || phams.length === 0) {
      console.log("Phams collection empty for", currentDataset, "- computing from Genomes...");
      const stats = await Genomes.rawCollection().aggregate([
        { $match: { dataset: currentDataset } },
        { $unwind: "$genes" },
        { $group: { _id: "$genes.phamName", size: { $sum: 1 } } }
      ]).toArray();

      // Transform aggregation result to expected format: { PhamID: "123", size: 10 }
      phams = stats.map(s => ({ PhamID: s._id, size: s.size }));
    }

    let phamsObj = phams.reduce(function (o, currentArray) {
      let n = currentArray.PhamID;
      let v = currentArray.size;
      o[n] = v;
      return o
    }, {});
    return phamsObj;
  },

  "get_clusters_by_pham": async function (dataset, phamname) {
    check(dataset, String);
    check(phamname, Match.OneOf(String, Number));

    let selectedClusterMembers = []; //array of objects of form {cluster: "A1", phages: ['L5', 'D29', ...]}

    console.log(`[get_clusters_by_pham] Called with dataset: '${dataset}', phamname: '${phamname}'`);

    if (phamname) {
      const numericPhamName = !isNaN(Number(phamname)) ? Number(phamname) : phamname;
      const phamNameStr = String(phamname);

      const matchingGenes = await Genes.find({
        dataset: dataset,
        $or: [
          { phamName: phamname },
          { phamName: numericPhamName },
          { phamName: phamNameStr }
        ]
      }, { fields: { phageID: 1, phagename: 1 } }).fetchAsync(); // asking for all variants to be safe in logs

      // the user had g.PhageID in the map, so we'll check multiple properties to be safe
      const phageNames = [...new Set(matchingGenes.map(g => g.phageID))].filter(Boolean);

      console.log(`[get_clusters_by_pham] Extracted unique Phage/Genome Identifiers:`, phageNames);

      if (phageNames.length === 0) {
        console.log(`[get_clusters_by_pham] Returning empty array because no underlying phage identifiers were found.`);
        return [];
      }

      const phamclusters = await Genomes.find({
        dataset: dataset,
        // Using $or to try matching the id against phagename, name, or phageID just in case!
        $or: [
          { phagename: { $in: phageNames } },
          { phageID: { $in: phageNames } },
          { name: { $in: phageNames } }
        ]
      }, { sort: { cluster: 1, subcluster: 1 }, fields: { _id: false, phagename: 1, name: 1, phageID: 1, cluster: 1, subcluster: 1, clusterSubcluster: 1 } }).fetchAsync();

      console.log(`[get_clusters_by_pham] Genomes found matching those identifiers: ${phamclusters.length}`);
      if (phamclusters.length > 0) {
        console.log(`[get_clusters_by_pham] Example matched Genome structure:`, phamclusters[0]);
      }

      phamclusters.forEach(function (x) {
        // Find whichever name property it actually possesses
        const actualPhageName = x.phagename || x.name || x.phageID || "Unknown_Phage";

        // Use clusterSubcluster field if available, otherwise intelligently combine cluster + subcluster
        // while avoiding appending subcluster if it already contains the cluster prefix (e.g. A + A1 -> AA1)
        let clusterName = x.clusterSubcluster;
        if (!clusterName) {
          let cl = x.cluster || "";
          let sub = x.subcluster || "";
          if (sub && String(sub).startsWith(cl)) {
            clusterName = String(sub);
          } else {
            clusterName = cl + String(sub);
          }
        }

        if (!x.cluster || x.cluster === "") {
          clusterName = "Singletons";
        }

        let thiscluster = selectedClusterMembers.find(y => y.cluster === clusterName);

        if (thiscluster === undefined) {
          thiscluster = {};
          thiscluster.cluster = clusterName;
          thiscluster.rawCluster = x.cluster || "";
          thiscluster.rawSubcluster = x.subcluster || "";
          thiscluster.phages = [];
          thiscluster.phages.push(actualPhageName);
          thiscluster.phages.sort();
          selectedClusterMembers.push(thiscluster);
        }
        else {
          thiscluster.phages.push(actualPhageName);
          thiscluster.phages.sort();
          selectedClusterMembers[selectedClusterMembers.indexOf(thiscluster)] = thiscluster;
        }
      });

      // Apply Phamerator's custom sorting algorithm
      selectedClusterMembers.sort(function (a, b) {
        // 1. Singletons (empty string or matching name) always first
        if (a.rawCluster === "" || a.cluster === "Singletons") return -1;
        if (b.rawCluster === "" || b.cluster === "Singletons") return 1;

        // 2. Single letter strings come before multi-letter strings
        if (a.rawCluster.length !== b.rawCluster.length) {
          return a.rawCluster.length - b.rawCluster.length;
        }

        // 3. Alphabetical sort for strings of the same length
        let clusterCmp = a.rawCluster.localeCompare(b.rawCluster);
        if (clusterCmp !== 0) return clusterCmp; // Only use alphabetical tie-breaker if they are different

        // 4. Numerical sort for subclusters
        let numA = parseInt(a.rawSubcluster.toString().replace(/[^0-9]/g, ''), 10);
        let numB = parseInt(b.rawSubcluster.toString().replace(/[^0-9]/g, ''), 10);

        let isNumA = !isNaN(numA);
        let isNumB = !isNaN(numB);

        if (isNumA && isNumB) {
          if (numA !== numB) return numA - numB;
        }

        return a.rawSubcluster.toString().localeCompare(b.rawSubcluster.toString());
      });

      console.log(`[get_clusters_by_pham] Final Selected Cluster array length: ${selectedClusterMembers.length}`);
      return selectedClusterMembers;
    }
    return [];
  },

  "get_genes_by_domain": async function (domainID, dataset) {
    check(domainID, String);
    check(dataset, String);
    return await Domains.find({ dataset: dataset, DomainID: domainID }).fetchAsync()
  },

  "get_tRNAs_by_phage": async function (PhageID, dataset) {
    check(PhageID, String);
    check(dataset, String);
    let tRNAs = await TRNAs.find({ dataset: dataset, PhageID: PhageID }).fetchAsync()
    return tRNAs;
  },

  "get_all_domains_by_query": async function (domainDescription, dataset) {
    check(domainDescription, String);
    check(dataset, String);
    return await Domains.find({ description: new RegExp(domainDescription), dataset: dataset }, { sort: { geneID: 1 } }).fetchAsync()
  },

  "get_domains_by_query": async function (domainDescription, dataset) {
    check(domainDescription, String);
    check(dataset, String);
    // get all the DomainIDs whose description matches the query
    const domainIDs = await Domains.rawCollection().distinct('DomainID', { description: new RegExp(domainDescription), dataset: dataset });

    const domains = await Promise.all(domainIDs.map(async (domainID) => {
      const d = await Domains.findOneAsync({ DomainID: domainID, dataset: dataset }, { domainID: true, description: true })
      return d
    }));

    return domains
  },

  "get_domains_by_gene": async function (geneID, dataset) {
    check(geneID, String);
    check(dataset, String);
    let domains = await Domains.find({ geneID: geneID, dataset: dataset }).fetchAsync();
    domains.forEach(function (d) {
      d.domainLink = "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=" + d.DomainID;
    })
    return domains;
  },

  "get_tm_domains_by_gene": async function (geneID, dataset) {
    check(geneID, String);
    check(dataset, String);
    let tmdomains = await TMDomains.find({ geneID: geneID, dataset: dataset }).fetchAsync();
    return tmdomains;
  },

  "getlargestphamsize": async function () {
    const pham = await Phams.findOneAsync({}, { sort: { size: -1 } });
    return pham ? pham.size : 0;
  },

  "get_number_of_domains": async function (geneID, dataset) {
    check(geneID, String);
    check(dataset, String);
    const domainsCount = await Domains.find({ geneID: geneID, dataset: dataset }).countAsync();
    return { "geneID": geneID, "domainsCount": domainsCount };
  },

  "get_number_of_genomes": async function () {
    const genomeCount = await Genomes.find({ dataset: "Actino_Draft" }).countAsync();
    console.log("get_number_of_genomes", genomeCount);
    return genomeCount;
  },


  "getclusters": async function (currentDataset) {
    check(currentDataset, String);
    if (!Meteor.userId()) return [];

    let allowed = false;
    const scopes = await Roles.getScopesForUserAsync(Meteor.userId(), "view");
    if (scopes.includes(currentDataset)) {
      allowed = true;
    } else {
      const d = await Datasets.findOneAsync({ name: currentDataset, public: true });
      if (d) allowed = true;
    }

    if (!allowed) return [];

    // Optimize: Single query to retrieve all required phage metadata instantly
    const allPhages = await Genomes.find(
      { dataset: currentDataset },
      { fields: { _id: 1, phagename: 1, cluster: 1, subcluster: 1, clusterSubcluster: 1, genomelength: 1, phageID: 1 } }
    ).fetchAsync();

    // Grouping by cluster -> subcluster natively
    let clustersMap = {};
    for (const p of allPhages) {
      const c = p.cluster || "";
      const sc = p.subcluster || "";

      if (!clustersMap[c]) clustersMap[c] = {};
      if (!clustersMap[c][sc]) {
        clustersMap[c][sc] = {
          clusterDisplayName: p.clusterSubcluster || (c === "" ? "Singletons" : c + sc),
          phages: []
        };
      }
      clustersMap[c][sc].phages.push(p);
    }

    let clusters = [];

    let clusterNames = Object.keys(clustersMap).sort(function (a, b) {
      if (a === "") return -1;
      if (b === "") return 1;
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });

    for (const c of clusterNames) {
      let subClusterNames = Object.keys(clustersMap[c]).sort(function (a, b) {
        let numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
        let numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
        let isNumA = !isNaN(numA);
        let isNumB = !isNaN(numB);

        if (isNumA && isNumB) {
          if (numA !== numB) return numA - numB;
        }
        return a.localeCompare(b);
      });

      for (const sc of subClusterNames) {
        let phages = clustersMap[c][sc].phages;
        phages.sort((a, b) => a.phagename.localeCompare(b.phagename));

        clusters.push({
          name: clustersMap[c][sc].clusterDisplayName,
          cluster: c,
          subcluster: sc,
          phages: phages
        });
      }
    }

    return clusters;
  }
});
