import { Meteor } from 'meteor/meteor';
// import 'meteor/aldeed:collection2'; // Patch Meteor.Collection

import SimpleSchema from 'simpl-schema';
SimpleSchema.extendOptions(['autoform']);

// Helper to define global variables in a module system

export const TRNAs = new Meteor.Collection("trnas");
export const Genomes = new Meteor.Collection("genomes");
export const Phams = new Meteor.Collection("phams");
export const Domains = new Meteor.Collection("domains");
export const TMDomains = new Meteor.Collection("tmdomains");
export const Datasets = new Meteor.Collection("datasets");
export const Genes = new Meteor.Collection("genes");
export const Proteins = new Meteor.Collection("proteins");

Meteor.startup(function () {

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
});