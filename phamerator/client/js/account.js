import { ReactiveVar } from 'meteor/reactive-var';

Template.account.onCreated(function () {
  this.subscribe('fullname');
  this.subscribe('apiKeys');
  this.newApiKey = new ReactiveVar(null);
});

Template.account.onRendered(function () {
  $("html, body").animate({ scrollTop: 0 }, "slow");

});

Template.account.helpers({
  email: function () {
    return Meteor.user()?.emails?.[0]?.address || null;
  },
  username: function () {
    return Meteor.user()?.username || null;
  },
  name: function () {
    return Meteor.user()?.name || null;
  },
  includeInDirectory: function () {
    return Meteor.user()?.profile?.includeInDirectory || false;
  },
  apiKey: function () {
    const keys = Meteor.user()?.apiKeys;
    if (keys && keys.length > 0) {
      return keys[0];
    }
    return null;
  },
  newApiKey: function () {
    return Template.instance().newApiKey.get();
  }
});

Template.account.events({
  "change #directoryinfo-yes": function () {
    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.includeInDirectory': true } });;
  },
  "change #directoryinfo-no": function () {
    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.includeInDirectory': false } });;
  },
  "click #generate-api-key": function (e, instance) {
    e.preventDefault();
    Meteor.call('generateApiKey', function (error, result) {
      if (error) {
        M.toast({ html: 'Error generating API key: ' + error.reason, classes: 'red' });
      } else {
        instance.newApiKey.set(result);
        M.toast({ html: 'API key generated successfully', classes: 'green' });
      }
    });
  },
  "click #delete-api-key": function (e, instance) {
    e.preventDefault();
    Meteor.call('deleteApiKey', function (error) {
      if (error) {
        M.toast({ html: 'Error deleting API key: ' + error.reason, classes: 'red' });
      } else {
        instance.newApiKey.set(null);
        M.toast({ html: 'API key deleted successfully', classes: 'green' });
      }
    });
  }
})
