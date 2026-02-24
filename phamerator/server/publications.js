import { Roles } from 'meteor/alanning:roles';

// set up Genomes collection
// publish just genome names and clusters

Meteor.publish("allUsers", function () {
  return Meteor.users.find({ 'profile.includeInDirectory': true }, { fields: { name: 1, emails: 1, roles: 1, username: 1, profile: 1 } });
})


Meteor.publishComposite("genomes", function (dataset) {
  return {
    find: async function () {
      if (dataset === 'Actino_Draft') {
        const d = await Datasets.findOneAsync({ name: 'Actino_Draft' });
        return Datasets.find({ name: 'Actino_Draft' });
      }

      if (!this.userId) return;

      const user = await Meteor.users.findOneAsync(this.userId);
      console.log('Legacy User Roles:', JSON.stringify(user.roles));

      console.log('Publishing genomes for user:', this.userId);
      const scopes = await Roles.getScopesForUserAsync(this.userId, "view");
      console.log('Scopes (Datasets) for user:', scopes);
      return Datasets.find({ 'name': { $in: scopes } });
    },
    children: [{
      find: async function () {
        if (dataset === 'Actino_Draft') {
          return Genomes.find({ dataset: dataset }, { fields: { phageID: 1, phagename: 1, genomelength: 1, cluster: 1, subcluster: 1, dataset: 1 } });
        }

        if (!this.userId) return;

        const scopes = await Roles.getScopesForUserAsync(this.userId, "view");
        if (!scopes.includes(dataset)) {
          return;
        }
        return Genomes.find({ dataset: dataset }, { fields: { phageID: 1, phagename: 1, genomelength: 1, cluster: 1, subcluster: 1, dataset: 1 } });
      }
    }]
  }
});

Meteor.publish("domains", function (dataset) {
  if (dataset) {
    return Domains.find({ dataset: dataset })
  }
  else {
    return this.stop()
  }
})

Meteor.publish("selected_tRNAs", async function (dataset, selectedGenomes) {
  if (dataset) {
    if (dataset === 'Actino_Draft') {
      return TRNAs.find({ "PhageID": { $in: selectedGenomes }, dataset: dataset });
    }

    if (!this.userId) return;

    var datasets = await Roles.getScopesForUserAsync(this.userId, "view")
    if (!datasets.includes(dataset)) { return [] }

    return TRNAs.find({ "PhageID": { $in: selectedGenomes }, dataset: dataset });
  }
  else {
    return this.stop();
  }
})

Meteor.publish("genomesWithSeq", async function (dataset, selectedGenomes) {
  if (dataset) {
    if (dataset === 'Actino_Draft') {
      const genomeCursor = Genomes.find({ "phagename": { $in: selectedGenomes }, dataset: dataset });
      const genomes = await genomeCursor.fetchAsync();
      const genomeIds = genomes.map(g => g._id);
      return [
        genomeCursor,
        Genes.find({ genome: { $in: genomeIds } })
      ];
    }

    if (!this.userId) return [];

    var datasets = await Roles.getScopesForUserAsync(this.userId, "view")
    if (!datasets.includes(dataset)) { return [] }

    const genomeCursor = Genomes.find({ "phagename": { $in: selectedGenomes }, dataset: dataset }, { fields: { genes: 1, sequence: 1, phageID: 1, phagename: 1, genomelength: 1, cluster: 1, subcluster: 1, dataset: 1, clusterSubcluster: 1 } });
    const genomes = await genomeCursor.fetchAsync();
    const genomeIds = genomes.map(g => g._id);
    return [
      genomeCursor,
      Genes.find({ genome: { $in: genomeIds } })
    ];
  }
  else {
    return this.stop();
  }
});

Meteor.publish("proteinSeq", function (phagename) {
  return Proteins.find({ "phagename": phagename });
});

Meteor.publishComposite("datasets", {
  find: function () {
    return Meteor.users.find({ _id: this.userId });
  },
  children: [{
    find: async function () {
      if (!this.userId) {
        return Datasets.find({ "name": "Actino_Draft" });
      }
      return Datasets.find({
        $or: [
          { "name": "Actino_Draft" },
          { "name": { $in: await Roles.getScopesForUserAsync(this.userId, "view") } }
        ]
      });
    }
  }]
});

Meteor.publish('preferredDataset', function () {
  return Meteor.users.find({ _id: this.userId }, { fields: { preferredDataset: 1 } });
});

Meteor.publish('files.images.all', function () {
  return Images.find().cursor;
});

Meteor.publish('selectedData', function () {
  return Meteor.users.find({ _id: this.userId }, { fields: { selectedData: 1 } });
});

Meteor.publish('featureDiscovery', function () {
  return Meteor.users.find({ _id: this.userId }, { fields: { featureDiscovery: 1 } });
});

Meteor.publish('newTermsAndPolicies', function () {
  return Meteor.users.find({ _id: this.userId }, { fields: { newTermsAndPolicies: 1 } });
});

Meteor.publish('fullname', function () {
  return Meteor.users.find({ _id: this.userId }, { fields: { name: 1 } });
});

Meteor.publish('phameratorVersion', function () {
  return PhameratorVersion.find({}, { fields: { version: 1 } });
});

Meteor.users.find({ "status.online": true }).observe({
  added: function (id) {
    // console.log(new Date().toLocaleString(), "[ONLINE]:  ", id.username, "(" + id.name + ")", id.emails[0]);
  },
  removed: function (id) {
    // console.log(new Date().toLocaleString(), "[OFFLINE]: ", id.username, "(" + id.name + ")", id.emails[0]);
  }
});
