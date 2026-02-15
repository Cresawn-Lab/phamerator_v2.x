import { Meteor } from 'meteor/meteor';
import { FilesCollection } from 'meteor/ostrio:files';
import 'meteor/aldeed:collection2'; // Patch Meteor.Collection

import SimpleSchema from 'simpl-schema';
SimpleSchema.extendOptions(['autoform']);

// Helper to define global variables in a module system
const _global = typeof global !== 'undefined' ? global : window;

export const TRNAs = new Meteor.Collection("trnas");
_global.TRNAs = TRNAs;

export const Genomes = new Meteor.Collection("genomes");
_global.Genomes = Genomes;
export const Phams = new Meteor.Collection("phams");
_global.Phams = Phams;
export const Proteins = new Meteor.Collection("proteins");
_global.Proteins = Proteins;
export const Domains = new Meteor.Collection("domains");
_global.Domains = Domains;
export const TMDomains = new Meteor.Collection("tmdomains");
_global.TMDomains = TMDomains;
export const Datasets = new Meteor.Collection("datasets");
_global.Datasets = Datasets;

Meteor.startup(function () {
  // if (Meteor.isCordova && navigator.connection.type == 'WIFI') { Ground.Collection(Genomes); }

  var Schemas = {};

  Schemas.Genome = new SimpleSchema({
    phageID: {
      type: String,
      label: "Phage ID"
    },
    name: {
      type: String,
      label: "Name",
      max: 20
    },
    finder: {
      type: String,
      label: "Found By"
    },
    sequence: {
      type: String,
      label: "Genome Sequence",
      min: 0
    },
    genomelength: {
      type: Number,
      label: "Sequence Length"
    },
    isProphage: {
      type: Boolean,
      label: "Prophage",
      optional: true
    },
    GC: {
      type: Number,
      label: "GC %"
    },
    cluster: {
      type: String,
      label: "Cluster",
      max: 2
    },
    subCluster: {
      type: Number,
      label: "Subcluster"
    },
    dateFound: {
      type: Date,
      label: "Date Found",
      optional: true
    },
    selected: {
      type: Boolean,
      optional: true
    }
  });

  // _global.Genomes.attachSchema(Schemas.Genome);
});

export const Images = new FilesCollection({
  collectionName: 'Images',
  storagePath: '../data/phamerator/uploads',
  allowClientCode: false, // Disallow remove files from Client
  debug: true,
  onBeforeUpload: function (file) {
    // Allow upload files under 10MB, and only in png/jpg/jpeg formats
    return true;
    if (file.size <= 10485760 && /png|jpg|jpeg/i.test(file.extension)) {
      return true;
    } else {
      return 'Please upload image, with size equal or less than 10MB';
    }
  }
});
_global.Images = Images;
