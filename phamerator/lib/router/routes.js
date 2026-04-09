import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Meteor } from 'meteor/meteor';

if (Meteor.isClient) {
  // Dynamic import to avoid server-side issues
  import('/client/js/layout.js').then(({ render }) => {

    FlowRouter.route('/', {
      name: 'home',
      action() {
        render('masterLayout', { main: 'home', nav: 'nav' });
      }
    });

    FlowRouter.route('/login/:email/:token', {
      name: 'magicLinkLogin',
      action(params) {
        render('masterLayout', { main: 'confirmLogin', nav: 'nav' });
      }
    });

    FlowRouter.route('/phages', {
      name: 'phages',
      triggersEnter: [function (context, redirect) {
        if (!Meteor.userId()) {
          redirect('/');
        }
      }],
      action() {
        render('masterLayout', { main: 'phages', nav: 'nav' });
      }
    });

    FlowRouter.route('/phamilies', {
      name: 'phamilies',
      action() {
        render('masterLayout', { main: 'phamilies', nav: 'nav' });
      }
    });

    FlowRouter.route('/newDatabase', {
      name: 'newDatabase',
      action() {
        render('masterLayout', { main: 'newDatabase', nav: 'nav' });
      }
    });

    FlowRouter.route('/cresawnlab', {
      name: 'cresawnlab',
      action() {
        render('masterLayout', { main: 'cresawnlab', nav: 'nav' });
      }
    });

    FlowRouter.route('/domains', {
      name: 'domains',
      triggersEnter: [function (context, redirect) {
        if (!Meteor.userId()) {
          redirect('/');
        }
      }],
      action() {
        render('masterLayout', { main: 'domains', nav: 'nav' });
      }
    });

    FlowRouter.route('/terms', {
      name: 'terms',
      action() {
        render('masterLayout', { main: 'terms', nav: 'nav' });
      }
    });

    FlowRouter.route('/account', {
      name: 'account',
      triggersEnter: [function (context, redirect) {
        if (!Meteor.userId()) {
          redirect('/');
        }
      }],
      action() {
        render('masterLayout', { main: 'account', nav: 'nav' });
      }
    });

    // Handle 404
    FlowRouter.route('*', {
      action() {
        render('masterLayout', { main: 'page_not_found', nav: 'nav' });
      }
    });
  });
}

// NOTE: Subscriptions previously in 'waitOn' must now be moved to the 
// onCreated() callbacks of the respective templates (e.g. home.js, phages.js).
