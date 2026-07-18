import { ReactiveVar } from 'meteor/reactive-var';
import { Template } from 'meteor/templating';

// Global layout state
export const LayoutState = {
  layout: new ReactiveVar('masterLayout'),
  nav: new ReactiveVar('nav'), // Default to 'nav' since it's used everywhere
  main: new ReactiveVar('loading'),
};

// Global helper to render layout
export const render = (layout, regions) => {
  if (layout) LayoutState.layout.set(layout);
  if (regions.main) LayoutState.main.set(regions.main);
  if (regions.nav) LayoutState.nav.set(regions.nav);
};

// Register helpers on masterLayout (or globally) so {{> Template.dynamic template=main}} works
// Register helpers on masterLayout (or globally) so {{> Template.dynamic template=main}} works
Template.registerHelper('main', () => LayoutState.main.get());
Template.registerHelper('nav', () => LayoutState.nav.get());
Template.registerHelper('currentLayout', () => LayoutState.layout.get());

import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';

// Add an autorun to handle logging out while on protected routes, and clean up global subscriptions
Meteor.startup(() => {
  Tracker.autorun(() => {
    const currentRoute = FlowRouter.getRouteName();
    const isLoggingIn = Meteor.loggingIn();
    const userId = Meteor.userId();
    const user = Meteor.user();

    // Initialize preferred dataset globally on login if one is saved and none is active
    if (user && user.preferredDataset && !Session.get("currentDataset")) {
      Session.set("currentDataset", user.preferredDataset);
    }

    if (userId) {
      // User is logged in, start global subscriptions
      // (Tracker.autorun will automatically stop these if this block is no longer reached, e.g., when userId becomes null)
      Meteor.subscribe('allUsers');
      Meteor.subscribe('fullname');
      Meteor.subscribe('featureDiscovery', function () {
        const user = Meteor.user();
        if (user && user.profile && user.profile.includeInDirectory == null) {
          M.toast({ html: 'Please review your<a href="account">account settings</a>', displayLength: 5000 });
        }
        if (user && user.featureDiscovery == null) {
          Session.set("geneTranslation", true);
        }
        else if (user && user.featureDiscovery && user.featureDiscovery.geneTranslation == null) {
          Session.set("geneTranslation", true);
        }
        else if (user && user.featureDiscovery) {
          geneTranslation = user.featureDiscovery.geneTranslation;
          Session.set("geneTranslation", geneTranslation);
        }
      });
    } else if (!isLoggingIn) {
      // User is logged out
      Session.set("currentDataset", undefined);

      if (currentRoute === 'phages' || currentRoute === 'domains' || currentRoute === 'account') {
        FlowRouter.go('/');
      }

      // Stop any active genome handlers gracefully using standard global var syntax
      if (typeof genomesWithSeqHandle !== 'undefined' && genomesWithSeqHandle && genomesWithSeqHandle.stop) {
        genomesWithSeqHandle.stop();
      }
      if (typeof genomesWithSeqHandlers !== 'undefined' && Array.isArray(genomesWithSeqHandlers)) {
        genomesWithSeqHandlers.forEach(handler => {
          if (handler && handler.stop) handler.stop();
        });
        genomesWithSeqHandlers = [];
      }

      // Clear out locally cached client map sessions
      if (typeof selectedGenomes !== 'undefined') {
        selectedGenomes.remove({});
      }
      if (typeof alignedGenomes !== 'undefined') {
        alignedGenomes.remove({});
      }
    }
  });
});

Template.registerHelper('pathFor', (routeName, params) => {
  // Handle both {{pathFor 'name'}} and {{pathFor route='name'}} if applicable, 
  // but mostly it is positional.
  // Note: Blaze helper arguments: (arg1, arg2, ..., keywordArgs)
  // If called as {{pathFor 'home'}}, routeName is 'home'.
  return FlowRouter.path(routeName);
});

Template.registerHelper('isActiveRoute', (kwargs) => {
  // Usage: {{isActiveRoute regex='home'}}
  // kwargs.hash.regex contains the route name or regex
  const pattern = kwargs && kwargs.hash && kwargs.hash.regex;
  if (!pattern) return '';
  FlowRouter.watchPathChange();

  const current = FlowRouter.getRouteName();


  // For now, assume it matches route name substring or exact.
  if (current && current === pattern) return 'active';
  return '';
});
