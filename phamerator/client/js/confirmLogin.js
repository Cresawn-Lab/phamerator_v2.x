import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Meteor } from 'meteor/meteor';

Template.confirmLogin.events({
    'click #confirm-signin'(event, instance) {
        const email = FlowRouter.getParam('email');
        const token = FlowRouter.getParam('token');

        if (!email || !token) {
            M.toast({ html: 'Invalid login link structure.', classes: 'red' });
            FlowRouter.go('/');
            return;
        }

        // Visual feedback
        const btn = event.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        Meteor.passwordlessLoginWithToken(email, token, (err) => {
            if (err) {
                M.toast({ html: 'Failed to sign in: ' + (err.reason || 'Invalid or expired link'), classes: 'red' });
                btn.disabled = false;
                btn.textContent = 'Finalize Sign In';
            } else {
                M.toast({ html: 'Successfully signed in!', classes: 'green' });
                FlowRouter.go('/');
            }
        });
    }
});
