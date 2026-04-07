import { Random } from 'meteor/random';
import { Roles } from 'meteor/alanning:roles';
import { Accounts } from 'meteor/accounts-base';

Accounts.config({
  tokenSequenceLength: 32, // More secure for links
  loginTokenExpirationHours: 1
});

Accounts.urls.loginToken = function(email, sequence) {
  return Meteor.absoluteUrl('login/' + encodeURIComponent(email) + '/' + encodeURIComponent(sequence));
};

Accounts.emailTemplates.from = 'Phamerator <no-reply@phamerator.org>';
Accounts.emailTemplates.sendLoginToken = {
  subject() {
    return 'Your Phamerator Magic Link';
  },
  text(user, url) {
    return `Hello!\n\nClick the link below to securely sign in to Phamerator. No password is required.\n\n${url}\n\nIf you did not request this link, you can safely ignore this email.\n\nThe Phamerator Team`;
  }
};

Accounts.onCreateUser(async function (options, user) {
  // Assigns first and last names to the newly created user object
  if (!user._id) user._id = Random.id();

  user.featureDiscovery = ['geneTranslation', 'phamMembersByCluster', 'phamAbundance', 'geneNotes'];
  user.newTermsAndPolicies = true;
  if (!user.name) {
    if (options.profile && options.profile.name) {
      user.name = options.profile.name;
    } else if (user.emails && user.emails.length > 0) {
      user.name = user.emails[0].address.split('@')[0];
    } else {
      user.name = 'Unknown';
    }
  }

  // Assign default roles using V4 API
  await Roles.addUsersToRolesAsync(user._id, ['owner', 'view'], 'Actino_Draft');

  user.preferredDataset = 'Actino_Draft'
  user.profile = options.profile || {};
  user.GenesDB_assigned_genomes = [];
  user.selectedData = {
    "Actino_Draft": {
      "genomeMaps": []
    }
  }

  return user;
});
