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
    M.Modal.init(document.getElementById('editDataset'), {
      onOpenStart: function (modal, trigger) {
        $('#editDataset .modal-content').animate({ scrollTop: 0 }, "fast");
      },
      onCloseEnd: function () {
        $('input#autocomplete-input.autocomplete')[0].value = "";
      }
    });
  });

  waitForEl("#infoDataset", function () {
    M.Modal.init(document.getElementById('infoDataset'), {
      onOpenStart: function (modal, trigger) {
        $('#infoDataset .modal-content').animate({ scrollTop: 0 }, "fast");
      }
    });
  });
});

Template.datasetDropdown.onDestroyed(function () {
  Session.keys = {};
});

Template.datasetDropdown.helpers({
  datasets: function () {
    waitForEl(".dropdown-trigger", function () {
      $(".dropdown-trigger").dropdown({ hover: false, constrainWidth: false })
    })

    if (Datasets.find().count() === 0) {
      Session.set("preferredDataset", "No data sets available")
    } else if (!Session.get("preferredDataset") || Session.get("preferredDataset") === "No data sets available") {
      Session.set("preferredDataset", "Choose a Data Set")
    }
    return Datasets.find().fetch();
  },
})
