import { Random } from 'meteor/random';
import { Roles } from 'meteor/alanning:roles';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import { SHA256 } from 'meteor/sha';
import { Email } from 'meteor/email';
import { check } from 'meteor/check';

Accounts.config({
  tokenSequenceLength: 32, // More secure for links
  loginTokenExpirationHours: 1
});

Accounts.registerLoginHandler('loginCode', async (options) => {
  if (!options.loginCode) return undefined;

  check(options, {
    loginCode: String,
    email: String
  });

  const email = options.email;
  const code = options.loginCode.trim();

  const user = await Meteor.users.findOneAsync({
    "emails.address": { $regex: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") }
  });

  if (!user) {
    throw new Meteor.Error(403, "User not found");
  }

  const loginCode = user.services?.loginCodes?.phamerator_v2_5;
  if (!loginCode || !loginCode.hashedCode || !loginCode.expiresAt) {
    throw new Meteor.Error(403, "No login code requested");
  }

  if (new Date() > loginCode.expiresAt) {
    await Meteor.users.updateAsync(
      { _id: user._id },
      { $unset: { "services.loginCodes.phamerator_v2_5": "" } }
    );
    throw new Meteor.Error(403, "Login code has expired");
  }

  const hashedInput = SHA256(code);
  if (hashedInput !== loginCode.hashedCode) {
    throw new Meteor.Error(403, "Invalid login code");
  }

  // Clear code after successful verification so it can't be reused
  await Meteor.users.updateAsync(
    { _id: user._id },
    { $unset: { "services.loginCodes.phamerator_v2_5": "" } }
  );

  return {
    userId: user._id
  };
});

Meteor.methods({
  async sendLoginCode(email) {
    check(email, String);

    let user = await Meteor.users.findOneAsync({
      "emails.address": { $regex: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") }
    });

    if (!user) {
      // Create user if they don't exist
      const userId = await Accounts.insertUserDoc({}, {
        emails: [{ address: email, verified: false }]
      });
      user = await Meteor.users.findOneAsync(userId);
    }

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save hashed code and expiration on the user object
    await Meteor.users.updateAsync(
      { _id: user._id },
      {
        $set: {
          "services.loginCodes.phamerator_v2_5": {
            hashedCode: SHA256(code),
            expiresAt: expiresAt
          }
        }
      }
    );

    // Send the email
    await Email.sendAsync({
      to: email,
      from: 'Phamerator <no-reply@phamerator.org>',
      subject: 'Your Phamerator Login Code',
      text: `Hello!\n\nYour Phamerator login code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, you can safely ignore this email.\n\nThe Phamerator Team`
    });

    return true;
  }
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
