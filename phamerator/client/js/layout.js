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
  // Simple check: exact match or simple regex if needed. 
  // The old code used 'regex', implying it could be a pattern.
  // For now, assume it matches route name substring or exact.
  if (current && current === pattern) return 'active';
  return '';
});
