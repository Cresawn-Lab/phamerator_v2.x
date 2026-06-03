import { Template } from 'meteor/templating';
import { Accounts } from 'meteor/accounts-base';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Meteor } from 'meteor/meteor';

Template.magicLinkModal.onCreated(function () {
  this.state = new ReactiveDict();
  this.state.setDefault({
    codeSent: false,
    email: ''
  });
});

Template.magicLinkModal.onRendered(function () {
  const template = this;
  const elems = document.querySelectorAll('#magicLinkModal');
  M.Modal.init(elems, {
    onCloseEnd: function () {
      template.state.set('codeSent', false);
      template.state.set('email', '');
    }
  });
});

Template.magicLinkModal.helpers({
  codeSent() {
    return Template.instance().state.get('codeSent');
  },
  email() {
    return Template.instance().state.get('email');
  }
});

Template.magicLinkModal.events({
  'submit #magic-link-form': function (event, template) {
    event.preventDefault();
    const email = event.target.magic_email.value;

    if (email) {
      M.toast({ html: 'Sending login code...' });
      
      Meteor.call('sendLoginCode', email, (err) => {
        if (err) {
          M.toast({ html: `Error: ${err.reason || 'Could not send code.'}`, classes: 'red' });
        } else {
          M.toast({ html: 'Check your email for the login code!', classes: 'green' });
          template.state.set('email', email);
          template.state.set('codeSent', true);
        }
      });
    }
  },

  'click #btn-magic-link': function (event, template) {
    event.preventDefault();
    const email = template.find('#magic_email').value;

    if (!email) {
      M.toast({ html: 'Please enter a valid email address.', classes: 'red' });
      return;
    }

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
        template.find('#magic-link-form').reset();
      }
    });
  },

  'submit #verify-code-form': function (event, template) {
    event.preventDefault();
    const email = template.state.get('email');
    const code = event.target.verify_code.value;

    if (email && code) {
      M.toast({ html: 'Verifying code...' });

      Accounts.callLoginMethod({
        methodArguments: [{ loginCode: code, email: email }],
        userCallback: (err) => {
          if (err) {
            M.toast({ html: `Error: ${err.reason || 'Invalid code.'}`, classes: 'red' });
          } else {
            M.toast({ html: 'Successfully signed in!', classes: 'green' });
            
            // Close the modal and clear the form state
            var modalInstance = M.Modal.getInstance(document.getElementById('magicLinkModal'));
            if (modalInstance) {
              modalInstance.close();
            }
            template.state.set('codeSent', false);
            template.state.set('email', '');
          }
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
