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
  getUsersThatCanView();
  const el = document.getElementById('autocomplete-input');
  if (el) {
    el.addEventListener('input', function(e) {
      const val = e.target.value;
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
          // Remove focus to prevent datalist from staying open
          el.blur();
        }
      });
    });
  }
});

Template.editDatasetModal.onDestroyed(function () {
});

Template.editDatasetModal.helpers({
  autocompleteUsersList: function () {
    const users = Meteor.users.find({ 'profile.includeInDirectory': true }).fetch();
    const list = [];
    users.forEach(user => {
      if (!user.emails || user.emails.length === 0) return;
      const email = user.emails[0].address;
      const name = user.name || (user.profile && user.profile.name) || user.username || "Unknown";
      list.push(name + " (" + email + ")");
    });
    return list;
  },
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
  "click .badge .close, click .badge i": function (e, template) {
    const badge = e.currentTarget.closest('.badge') || e.target.closest('.badge');
    const id = badge ? badge.dataset.id : null;
    if (!id) return;

    // Call a meteor method to remove this user from the role
    Meteor.call("removeUserFromRole", id, 'view', Session.get("currentDataset"), (error, result) => {
      if (!error) {
        getUsersThatCanView();
      }
    });
  }
});
