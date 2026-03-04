import { ReactiveVar } from 'meteor/reactive-var';

Template.account.onCreated(function () {
  this.subscribe('fullname');
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
  }
});

Template.account.events({
  "change #directoryinfo-yes": function () {
    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.includeInDirectory': true } });;
  },
  "change #directoryinfo-no": function () {
    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.includeInDirectory': false } });;
  }
})
