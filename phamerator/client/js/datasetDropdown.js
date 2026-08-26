import { Datasets } from "/imports/api/collections";

Template.datasetDropdown.onCreated(function () {

});

Template.datasetDropdown.onRendered(function () {
  var self = this;

  this.subscribe('datasets');

  this.subscribe("preferredDataset");

  let loggedInUser = null;
  Tracker.autorun(() => {
    const user = Meteor.user();
    const isNewLogin = !loggedInUser && user;
    loggedInUser = user;

    if (isNewLogin && user.preferredDataset) {
      switch_dataset(user.preferredDataset);
    } else if (!user && Session.get("preferredDataset") !== "Choose a Data Set" && Datasets.find().count() > 0) {
      Session.set("preferredDataset", "Choose a Data Set");
    }
  });

  Tracker.autorun(() => {
    if (self.subscriptionsReady()) {
      Session.set("datasetsView", Datasets.find({}, { fields: { name: 1 } }).fetch());
    }
  });

  waitForEl("#editDataset", function () {
    const editModal = document.getElementById('editDataset');
    if (editModal) {
      editModal.addEventListener('show.bs.modal', function () {
        getUsersThatCanView();
        $('#editDataset .modal-body').animate({ scrollTop: 0 }, "fast");
      });
      editModal.addEventListener('hidden.bs.modal', function () {
        const input = document.getElementById('autocomplete-input');
        if (input) input.value = "";
      });
    }
  });

  waitForEl("#infoDataset", function () {
    const infoModal = document.getElementById('infoDataset');
    if (infoModal) {
      infoModal.addEventListener('show.bs.modal', function () {
        $('#infoDataset .modal-body').animate({ scrollTop: 0 }, "fast");
      });
    }
  });
});

Template.datasetDropdown.onDestroyed(function () {
  Session.keys = {};
});

Template.datasetDropdown.helpers({
  datasets: function () {

    if (Datasets.find().count() === 0) {
      Session.set("preferredDataset", "No data sets available")
    } else if (!Session.get("preferredDataset") || Session.get("preferredDataset") === "No data sets available") {
      Session.set("preferredDataset", "Choose a Data Set")
    }
    return Datasets.find().fetch();
  },
})
