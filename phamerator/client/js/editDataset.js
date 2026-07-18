getUsersThatCanView = function () {
  var activeDataset = Session.get("currentDataset");
  Meteor.call("getUsersInRole", 'view', activeDataset, function (error, users) {
    if (!error) {
      Session.set("usersThatCanView", users);
    }
  });
  return Session.get("usersThatCanView") || [];
}

getAutocompleteUsers = function () {
  const users = Meteor.users.find({ 'profile.includeInDirectory': true }).fetch();
  const autoCompleteUsers = {};
  users.forEach(user => {
    if (!user.emails || user.emails.length === 0) return; // Skip users without emails
    
    const email = user.emails[0].address;
    const name = user.name || (user.profile && user.profile.name) || user.username || "Unknown";
    
    const key = name + " (" + email + ")";
    autoCompleteUsers[key] = null;
  });
  return autoCompleteUsers;
}

Template.editDatasetModal.onRendered(function () {
  this.autorun(() => {
    const autoCompleteUsers = getAutocompleteUsers();
    const el = document.getElementById('autocomplete-input');
    if (!el) return;

    const instance = M.Autocomplete.getInstance(el);
    if (instance) {
      instance.updateData(autoCompleteUsers);
    } else {
      $(el).autocomplete({
        data: autoCompleteUsers,
        limit: 20, // The max amount of results that can be shown at once. Default: Infinity.
        onAutocomplete: function (val) {
          const regExp = /\(([^)]+)\)$/;
          const match = regExp.exec(val);
          if (!match) return;
          const email = match[1];
          const user = Meteor.users.findOne({ "emails.0.address": email });
          if (!user) return;
          const id = user._id;
          const currentDataset = Session.get('currentDataset');

          Meteor.call("addUserToRole", id, 'view', currentDataset, (error, result) => {
            if (!error) {
              getUsersThatCanView();
              el.value = "";
            }
          });
        },
        minLength: 1, // The minimum length of the input for the autocomplete to start. Default: 1.
      });
    }
  });
});

Template.editDatasetModal.onDestroyed(function () {
  $("#editDataset").remove();
})

Template.editDatasetModal.helpers({
  usersThatCanView: function () {

    var users = Session.get("usersThatCanView");

    var owner = Meteor.user();
    if (users != null) {
      viewers = users.filter(function (u) {
        return u._id !== owner._id
      })
      return viewers;
    }
    return [];
  },
  currentDataset: function () {
    return Session.get("currentDataset");
  },
  owner: function () {
    return Meteor.user();

  }
})

Template.editDatasetModal.events({
  "click div.chip > i": function (e, template) {
    var id = e.target.parentNode.dataset.id;
    // Call a meteor method to remove this user from the role
    Meteor.call("removeUserFromRole", id, 'view', Session.get("currentDataset"), (error, result) => {
      getUsersThatCanView();
    });
  }
});
