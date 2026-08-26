import { Datasets } from "/imports/api/collections";

Template.infoDatasetModal.onRendered(function () {
});

Template.infoDatasetModal.onDestroyed(function () {
});

Template.infoDatasetModal.helpers({
  currentDataset: function () {
    return Session.get("currentDataset");
  },
  metadata: function () {
    // check to see if currentDataset has a metadata field and return it
    return Datasets.findOne({ name: Session.get("currentDataset") });
  },
  resources: function () {
    let meta = Datasets.findOne({ name: Session.get("currentDataset") })?.metadata;
    return meta?.resources ? Object.values(meta.resources) : [];
  }
});
