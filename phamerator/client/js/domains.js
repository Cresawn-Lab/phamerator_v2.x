Template.domains.onCreated(function () {
});

Template.domains.onRendered(function () {
  $(document).ready(function () {

    document.getElementById('domain_input').addEventListener('change', function (evt) {
      let query = this.value
      $("#preloader").show(function () {

        Session.set('domainQuery', query)
        currentDataset = Session.get('currentDataset')

        if (query == null || query.trim() == "") {
          Session.set('domainMatches', []);
          $("#preloader").fadeOut(300).hide()

        }
        else {
          Meteor.call('get_all_domains_by_query', query, currentDataset, function (error, matches) {
            Session.set('domainMatches', matches);
            $("#preloader").fadeOut(300).hide()

          })
        }
      })
    })
  })
})

Template.domains.helpers({
  searchedDomains: function () {
    return Session.get('searchedDomains');
  },
  genes: function () {
    return Session.get('genesByDomain');
  },
  currentDataset: function () {
    return Session.get("currentDataset");
  },
  domainMatches: function () {
    return Session.get('domainMatches')
  },
  domainQuery: function () {
    return Session.get('domainQuery')
  }
});