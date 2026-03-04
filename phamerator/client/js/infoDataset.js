import { Datasets } from "/imports/api/collections";

Template.infoDatasetModal.onRendered(function () {
});

Template.infoDatasetModal.onDestroyed(function () {
  $("#editDataset").remove();
})

Template.infoDatasetModal.helpers({
  currentDataset: function () {
    return Session.get("currentDataset");
  }, metadata: function () {
    // check to see if currentDataset has a metadata field and return it
    return Datasets.findOne({ name: Session.get("currentDataset") });
  },
  resources: function () {
    let meta = Datasets.findOne({ name: Session.get("currentDataset") })?.metadata;
    return meta?.resources ? Object.values(meta.resources) : []
  }
})

Template.infoDatasetModal.events({
  "click div.chip > i": function (e, template) {
    var name = e.target.parentNode.firstChild.nodeValue;
    id = Meteor.users.findOne({ name: name })._id;
    // Call a meteor method to remove this user from the role
    Meteor.call("removeUserFromRole", id, 'view', Session.get("currentDataset"), (error, result) => {
      getUsersThatCanView();
    });
  }
});
