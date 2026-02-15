import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Meteor } from 'meteor/meteor';

// In a real app, you'd import 'render' from client/js/layout.js, 
// but since this file is in lib/ (shared), we need to be careful.
// Ideally, routes should be client-only or careful about imports.
// For now, we'll assume the render function is available globally or we dispatch differently.
// Actually, FlowRouter routes are strictly Client-side for rendering usually.

if (Meteor.isClient) {
  // Dynamic import to avoid server-side issues
  import('/client/js/layout.js').then(({ render }) => {

    FlowRouter.route('/', {
      name: 'home',
      action() {
        render('masterLayout', { main: 'home', nav: 'nav' });
      }
    });

    FlowRouter.route('/phages', {
      name: 'phages',
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
