import { TMDomains } from "/imports/api/collections";
import { TRNAs } from "/imports/api/collections";
import { Datasets } from "/imports/api/collections";
import { Genomes } from "/imports/api/collections";
import { Phams } from "/imports/api/collections";
import { Domains } from "/imports/api/collections";
import { Genes } from "/imports/api/collections";
import { Proteins } from "/imports/api/collections";

Meteor.methods({
  "userExists": async function (username) {
    return !!await Meteor.users.findOneAsync({
      username: username
    });
  },
  "addUserToRole": async function (user, role, group) {
    if (!this.userId) throw new Meteor.Error('401', 'Not logged in');
    const isOwner = await Roles.userIsInRoleAsync(this.userId, 'owner', group);
    if (!isOwner) throw new Meteor.Error('403', 'Not authorized: You must be an owner of this dataset.');

    await Roles.addUsersToRolesAsync(user, role, group);
    var key = "selectedData." + group;
    var projection = { key: { genomeMaps: [] } }
    await Meteor.users.updateAsync({ _id: user }, { $set: projection })
  },
  "removeUserFromRole": async function (user, role, group) {
    if (!this.userId) throw new Meteor.Error('401', 'Not logged in');
    const isOwner = await Roles.userIsInRoleAsync(this.userId, 'owner', group);
    if (!isOwner) throw new Meteor.Error('403', 'Not authorized: You must be an owner of this dataset.');

    await Roles.removeUsersFromRolesAsync(user, role, group);
    await Meteor.users.updateAsync({ _id: user }, { $set: { "preferredDataset": "" } })
  },
  "getUsersInRole": async function (role, group) {
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
    var fields = "selectedData." + dataset + ".genomeMaps"
    var set = {}
    const userDoc = await Meteor.users.findOneAsync({ _id: Meteor.userId() }, { fields: { selectedData: 1 } });
    selectedData = userDoc.selectedData;
    if (!selectedData[dataset]) {
      selectedData[dataset] = { genomeMaps: [] }
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
    }
    const userDoc2 = await Meteor.users.findOneAsync({ _id: Meteor.userId() }, { fields: { selectedData: 1 } });
    genomeMaps = userDoc2.selectedData[dataset].genomeMaps;

    if (phagename === "") {
      selectedData[dataset] = { genomeMaps: [] }
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
    }

    else if (addGenome === true && genomeMaps.indexOf(phagename) === -1) {
      genomeMaps.push(phagename);
      selectedData[dataset] = { genomeMaps: genomeMaps }
      await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
    }
    else if (addGenome === false) {
      var index = genomeMaps.indexOf(phagename);
      if (index > -1) {
        genomeMaps.splice(index, 1);
        selectedData[dataset] = { genomeMaps: genomeMaps }
        await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { selectedData: selectedData } });
      }
    }
  },
  "updateSubclusterFavorites": async function (dataset, subcluster, addFavorite) {

    // initialize selectedData.subclusterFavorites if it doesn't exist
    await Meteor.users.updateAsync({ _id: Meteor.userId(), 'selectedData.dataset.subclusterFavorites': { $exists: false } }, { $set: { 'selectedData.dataset.subclusterFavorites': [] } });
    const userDoc = await Meteor.users.findOneAsync({ _id: Meteor.userId() }, { fields: { "selectedData.dataset.subclusterFavorites": 1 } });
    favorites = userDoc.selectedData.dataset.subclusterFavorites;

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
  "updateFeatureDiscovery": async function (featureName) {

    // initialize selectedData.featureDiscovery if it doesn't exist
    await Meteor.users.updateAsync({ _id: Meteor.userId(), 'featureDiscovery': { $exists: false } }, { $set: { 'featureDiscovery': [] } });
    const userDoc = await Meteor.users.findOneAsync({ _id: Meteor.userId() }, { fields: { "featureDiscovery": 1 } });
    features = userDoc.featureDiscovery;

    // no features left to mark as seen by the user
    if (features.length === 0) {
      return;
    }
    features.shift();
    await Meteor.users.upsertAsync({ _id: Meteor.userId() }, { $set: { "featureDiscovery": features } });
  },
  "updateNewTermsAndPolicies": async function () {

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

    let selectedClusterMembers = []; //array of objects of form {cluster: "A1", phages: ['L5', 'D29', ...]}

    if (typeof phamname != null) {
      const phamclusters = await Genomes.find({
        dataset: dataset, genes: {
          $elemMatch: {
            phamName: { $eq: phamname }
          }
        }
      }, { sort: { cluster: 1, subcluster: 1 }, fields: { _id: false, phagename: 1, cluster: 1, subcluster: 1 } }).fetchAsync();

      phamclusters.map(function (x) {
        if (x.cluster === "") {
          x.cluster = "Singletons"
          x.subcluster = ""
        }
        if (x.cluster === "Singletons") {
          var thiscluster = selectedClusterMembers.find(y => y.cluster === "Singletons"); // find singletons
        }
        else {
          var thiscluster = selectedClusterMembers.find(y => y.cluster === (x.cluster + x.subcluster));
        }

        if (thiscluster == undefined) {
          thiscluster = {};
          thiscluster.cluster = x.cluster + x.subcluster;
          thiscluster.phages = [];
          thiscluster.phages.push(x.phagename);
          thiscluster.phages.sort();
          selectedClusterMembers.push(thiscluster);
        }
        else {
          thiscluster.phages.push(x.phagename);
          thiscluster.phages.sort();
          selectedClusterMembers[selectedClusterMembers.indexOf(thiscluster)] = thiscluster;
        }
      });
      return selectedClusterMembers;
    }
    else {
    }
  },

  "get_genes_by_domain": async function (domainID, dataset) {
    return await Domains.find({ dataset: dataset, DomainID: domainID }).fetchAsync()
  },

  "get_tRNAs_by_phage": async function (PhageID, dataset) {
    let tRNAs = await TRNAs.find({ dataset: dataset, PhageID: PhageID }).fetchAsync()
    return tRNAs;
  },

  "get_all_domains_by_query": async function (domainDescription, dataset) {
    return await Domains.find({ description: new RegExp(domainDescription), dataset: dataset }, { sort: { geneID: 1 } }).fetchAsync()
  },

  "get_domains_by_query": async function (domainDescription, dataset) {
    // get all the DomainIDs whose description matches the query
    const domainIDs = await Domains.rawCollection().distinct('DomainID', { description: new RegExp(domainDescription), dataset: dataset });

    const domains = await Promise.all(domainIDs.map(async (domainID) => {
      d = await Domains.findOneAsync({ DomainID: domainID, dataset: dataset }, { domainID: true, description: true })
      return d
    }));

    return domains
  },

  "get_domains_by_gene": async function (geneID, dataset) {
    let domains = await Domains.find({ geneID: geneID, dataset: dataset }).fetchAsync();
    domains.forEach(function (d) {
      d.domainLink = "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=" + d.DomainID;
    })
    return domains;
  },

  "get_tm_domains_by_gene": async function (geneID, dataset) {
    let tmdomains = await TMDomains.find({ geneID: geneID, dataset: dataset }).fetchAsync();
    return tmdomains;
  },

  "getlargestphamsize": async function () {
    const pham = await Phams.findOneAsync({}, { sort: { size: -1 } });
    return pham ? pham.size : 0;
  },

  "get_number_of_domains": async function (geneID, dataset) {
    domainsCount = await Domains.find({ geneID: geneID, dataset: dataset }).countAsync();
    return { "geneID": geneID, "domainsCount": domainsCount };
  },

  "get_number_of_genomes": async function () {
    const genomeCount = await Genomes.find({ dataset: "Actino_Draft" }).countAsync();
    console.log("get_number_of_genomes", genomeCount);
    return genomeCount;
  },


  "getclusters": async function (currentDataset) {
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

    let clusters = [];

    const distinctClusters = await Genomes.rawCollection().distinct('cluster', { "dataset": currentDataset });
    // distinct returns array of values directly in promise result

    let clusterNames = _.uniq(distinctClusters, false);
    clusterNames.sort(function (a, b) {
      // 1. Singletons (empty string) always first
      if (a === "") return -1;
      if (b === "") return 1;

      // 2. Single letter strings come before multi-letter strings
      if (a.length !== b.length) {
        return a.length - b.length;
      }

      // 3. Alphabetical sort for strings of the same length
      return a.localeCompare(b);
    });

    // for each cluster, get an array of unique subcluster names
    // Because we are in async loop, we use for...of or Promise.all. 
    // The original code was synchronous forEach. We need to await inside loop.

    for (const cluster of clusterNames) {
      const distinctSubclusters = await Genomes.rawCollection().distinct('subcluster', { "dataset": currentDataset, "cluster": cluster });
      let subClusterNames = _.uniq(distinctSubclusters, false);

      subClusterNames.sort(function (a, b) {
        let numA = parseInt(a.toString().replace(/[^0-9]/g, ''), 10);
        let numB = parseInt(b.toString().replace(/[^0-9]/g, ''), 10);

        let isNumA = !isNaN(numA);
        let isNumB = !isNaN(numB);

        if (isNumA && isNumB) {
          if (numA !== numB) return numA - numB;
        }

        return a.toString().localeCompare(b.toString());
      });

      for (const subcluster of subClusterNames) {
        const phages = await Genomes.find({
          dataset: currentDataset,
          cluster: cluster,
          subcluster: subcluster
        }, { fields: { phagename: true, clusterSubcluster: true }, reactive: false }).fetchAsync();

        let phageNames = phages.map(x => x.phagename);
        phageNames.sort();

        var singletonator = function () {
          if (cluster === "") {
            return { "name": "Singletons", "cluster": "", "subcluster": "", phageNames: phageNames }
          }
          else {
            let clusterDisplayName = cluster + subcluster;
            // Use clusterSubcluster field if available to avoid redundant prefixes (e.g., "AA1")
            if (phages.length > 0 && phages[0].clusterSubcluster) {
              clusterDisplayName = phages[0].clusterSubcluster;
            }
            return { "name": clusterDisplayName, "cluster": cluster, "subcluster": subcluster, phageNames: phageNames }
          }
        };
        var singletonated = singletonator();
        clusters.push(singletonated);
      }
    }
    return clusters;
  }
});
