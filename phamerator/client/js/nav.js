import { Datasets } from '/imports/api/collections.js';

switch_dataset = function (dataset) {
  selectedGenomes.remove({});
  if (typeof genomesWithSeqHandle !== 'undefined') {
    genomesWithSeqHandle.stop()
  }
  genomesWithSeqHandle = Meteor.subscribe("genomesWithSeq");
  Session.set("currentDataset", dataset);
  Session.set("preferredDataset", dataset);

  if (Meteor.userId()) {
    Meteor.call("updatePreferredDataset", dataset);
  }
  usersThatCanView = getUsersThatCanView()
  Tracker.autorun(() => {
    autoCompleteUsers = getAutocompleteUsers()

    $('input.autocomplete').autocomplete({
      data: autoCompleteUsers,
      limit: 20, // The max amount of results that can be shown at once. Default: Infinity.
      onAutocomplete: function (val) {
        var regExp = /\(([^)]+)\)/;
        var email = regExp.exec(val)[1];
        var id = Meteor.users.findOne({ "emails.0.address": email })._id
        var currentDataset = Session.get('currentDataset');

        Meteor.call("addUserToRole", id, 'view', currentDataset, (error, result) => {
          getUsersThatCanView();
          $('input#autocomplete-input.autocomplete')[0].value = "";
        })
      },
      minLength: 1, // The minimum length of the input for the autocomplete to start. Default: 1.
    });
  })

  genomesWithSeqHandlers.map(handler => handler.stop())
  genomesWithSeqHandlers = [];

  //all the subscriptions that have been subscribed.
  if (Meteor.default_connection && Meteor.default_connection._subscriptions) {
    var subs = Meteor.default_connection._subscriptions;
    var subSummary = {};

    // organize them by name so that you can see multiple occurrences
    Object.keys(subs).forEach(function (key) {
      var sub = subs[key];
      // you could filter out subs by the 'active' property if you need to
      if (subSummary[sub.name] && subSummary[sub.name].length > 0) {
        subSummary[sub.name].push(sub);
      } else {
        subSummary[sub.name] = [sub];
      }
    });
  }
}

Meteor.startup(function () {
  // Here we can be sure the plugin has been initialized
  Session.set("datasetsOwn", []);
  Session.set("datasetsView", []);
});

Template.nav.helpers({
  displayname: function () {
    const user = Meteor.user();
    if (!user) {
      return null;
    }
    if (user.name) return user.name;
    if (user.username) return user.username;
    // if (user.emails && user.emails.length > 0) return user.emails[0].address;
    return "My Account";
  },
  loggedIn: function () {
    return Meteor.user() != null;
  },
  preferredDataset: function () {
    return Session.get("currentDataset") || "Choose a data set";
  },
  iAmOwner: function () {
    var own = Session.get("datasetsOwn");
    var current = Session.get("currentDataset");
    if (own != null && current != null) {
      return Session.get("datasetsOwn").includes(Session.get("currentDataset"));
    }
    else { return false }
  },
  metadata: function () {
    // check to see if currentDataset has a metadata field and return it
    return Datasets.findOne({ name: Session.get("currentDataset") });
  },
  now: function () {
    let d = new Date()
    return d.getFullYear()
  }
});

Template.nav.onCreated(function () {
})

Template.nav.onRendered(function () {
  // reload the nav template when a new user signs in
  // cleanup data upon new user logging in

  Tracker.autorun(() => {
    // Only run this if we are actually logged in, else clear the session variables
    if (Meteor.userId()) {
      Meteor.call("getDatasetsIView", (error, result) => {
        if (!error) Session.set("datasetsView", result);
      });

      Meteor.call("getDatasetsIOwn", (error, result) => {
        if (!error) Session.set("datasetsOwn", result);
      });
    } else {
      Session.set("datasetsView", []);
      Session.set("datasetsOwn", []);
    }
  });

  var sidenavs = document.querySelectorAll('.sidenav');
  M.Sidenav.init(sidenavs, {
    edge: 'left',
    draggable: true
  });

  var dropdowns = document.querySelectorAll('.dropdown-trigger');
  M.Dropdown.init(dropdowns, {
    constrainWidth: false,
    coverTrigger: false
  });

});

Template.nav.events({
  "click #dropdown1 a": function (event, template) {
    switch_dataset(event.currentTarget.id)
  },
})
