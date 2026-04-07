import { Template } from 'meteor/templating';
import { Accounts } from 'meteor/accounts-base';

Template.magicLinkModal.onRendered(function () {
  var elems = document.querySelectorAll('#magicLinkModal');
  M.Modal.init(elems, {});
});

Template.magicLinkModal.events({
  'submit #magic-link-form': function (event, template) {
    event.preventDefault();
    const email = event.target.magic_email.value;

    if (email) {
      // Provide user feedback that we are sending
      M.toast({ html: 'Sending magic link...' });
      
      Accounts.requestLoginTokenForUser({ selector: email, userData: { email: email } }, (err) => {
        if (err) {
          M.toast({ html: `Error: ${err.reason || 'Could not send link.'}`, classes: 'red' });
        } else {
          M.toast({ html: 'Check your email for the login link!', classes: 'green', displayLength: 6000 });
          
          // Close the modal and clear the form
          var modalInstance = M.Modal.getInstance(document.getElementById('magicLinkModal'));
          if (modalInstance) {
            modalInstance.close();
          }
          event.target.reset();
        }
      });
    }
  }
});

Template.nav.events({
  'click .logout-btn': function (event) {
    event.preventDefault();
    Meteor.logout(function(err) {
      if (err) {
        console.error("Logout failed", err);
      } else {
        M.toast({ html: 'Successfully logged out', classes: 'green' });
      }
    });
  }
});
