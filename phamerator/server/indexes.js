import { Meteor } from 'meteor/meteor';
import {
  Genomes,
  Genes,
  TRNAs,
  Domains,
  TMDomains,
  Proteins,
  Datasets,
  Phams
} from '../imports/api/collections';

Meteor.startup(async function () {
  const indexes = [
    // Genomes
    [Genomes.rawCollection(), { dataset: 1, phagename: 1 }],
    [Genomes.rawCollection(), { dataset: 1, phageID: 1 }],
    [Genomes.rawCollection(), { dataset: 1, cluster: 1, subcluster: 1 }],
    [Genomes.rawCollection(), { phagename: 1 }],

    // Genes
    [Genes.rawCollection(), { genome: 1 }],
    [Genes.rawCollection(), { dataset: 1, phamName: 1 }],
    [Genes.rawCollection(), { dataset: 1, geneID: 1 }],
    [Genes.rawCollection(), { dataset: 1, phageID: 1 }],

    // TRNAs
    [TRNAs.rawCollection(), { dataset: 1, PhageID: 1 }],

    // Domains
    [Domains.rawCollection(), { dataset: 1, geneID: 1 }],
    [Domains.rawCollection(), { dataset: 1, DomainID: 1 }],

    // TMDomains
    [TMDomains.rawCollection(), { dataset: 1, geneID: 1 }],

    // Proteins
    [Proteins.rawCollection(), { phagename: 1 }],

    // Datasets
    [Datasets.rawCollection(), { name: 1, public: 1 }],
    [Datasets.rawCollection(), { public: 1 }],

    // Phams
    [Phams.rawCollection(), { dataset: 1, PhamID: 1 }],

    // Users
    [Meteor.users.rawCollection(), { preferredDataset: 1 }],
    [Meteor.users.rawCollection(), { 'profile.includeInDirectory': 1 }]
  ];

  for (const [coll, spec] of indexes) {
    try {
      await coll.createIndex(spec);
    } catch (err) {
      // Ignore if index already exists with different options
    }
  }
});
