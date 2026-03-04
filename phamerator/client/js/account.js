import { ReactiveVar } from 'meteor/reactive-var';
import { Images } from '/lib/collections.js';

Template.account.onCreated(function () {
  this.subscribe('files.images.all');
  this.subscribe('fullname');
});

Template.account.onRendered(function () {
  $("html, body").animate({ scrollTop: 0 }, "slow");

  $('#profilepic').hide().fadeIn('slow');
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

Template.uploadForm.onCreated(function () {
  this.currentUpload = new ReactiveVar(false);
});

Template.uploadForm.helpers({
  currentUpload: function () {
    return Template.instance().currentUpload.get();
  }
});

Template.uploadForm.events({
  'change #fileInput': function (e, template) {
    if (e.currentTarget.files && e.currentTarget.files[0]) {
      // We upload only one file, in case
      // multiple files were selected
      var upload = Images.insert({
        file: e.currentTarget.files[0],
        streams: 'dynamic',
        chunkSize: 'dynamic',
      }, false);

      upload.on('start', function () {
        template.currentUpload.set(this);
      });

      upload.on('end', function (error, fileObj) {
        if (error) {
          alert('Error during upload: ' + error);
        } else {
          Meteor.users.update({ _id: Meteor.user()._id }, { $set: { "profile.profilePic": fileObj._id } });
        }
        template.currentUpload.set(false);
      });
      upload.start();
    }
  }
});

Template.file.helpers({

  imageFile: function () {
    const user = Meteor.user();
    let profilePic = "";
    if (user && user.hasOwnProperty('profile') && user.profile.hasOwnProperty('profilePic')) {
      profilePic = user.profile.profilePic;
    }
    return Images.collection.findOne({ userId: user._id, _id: profilePic })

  },
  // videoFile: function () {
  //   return Videos.collection.findOne({});
  // }
});
