import { Random } from 'meteor/random';
import { Roles } from 'meteor/alanning:roles';

Accounts.onCreateUser(async function (options, user) {
  // Assigns first and last names to the newly created user object
  if (!user._id) user._id = Random.id();

  user.featureDiscovery = ['geneTranslation', 'phamMembersByCluster', 'phamAbundance', 'geneNotes'];
  user.newTermsAndPolicies = true;
  user.name = (options.profile && options.profile.name) ? options.profile.name : user.username;

  // Assign default roles using V4 API
  await Roles.addUsersToRolesAsync(user._id, ['view'], 'Actino_Draft');

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
