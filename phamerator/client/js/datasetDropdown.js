Template.datasetDropdown.onCreated(function () {

});

Template.datasetDropdown.onRendered(function () {
  var self = this;

  Meteor.subscribe('allUsers');
  this.subscribe('datasets');

  this.subscribe("preferredDataset", function () {
    if (Meteor.user() && Meteor.user().preferredDataset) {
      switch_dataset(Meteor.user().preferredDataset)
    }
  })

  if (self.subscriptionsReady()) {
    Session.set("preferredDataset", preferredDataset)
    Session.set("datasetsView", Datasets.find({}, { fields: { name: 1 } }).fetch())
  }
  else { }

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
    if (Datasets.find().fetch().length === 0) {
      Session.set("preferredDataset", "No data sets available")
    }
    else {
      if (Meteor.user().preferredDataset != "") {
        Session.set("preferredDataset", Meteor.user().preferredDataset)
      }
      else {
        Session.set("preferredDataset", "Choose a Data Set")
      }
    }
    return Datasets.find().fetch();
  },
})
