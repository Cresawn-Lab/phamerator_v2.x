Template.home.onCreated(function () {
  Meteor.subscribe('allUsers');

  this.genomeCount = new ReactiveVar(null);

  Meteor.call('get_number_of_genomes', (error, result) => {
    if (error) {
      console.error('Error fetching genome count:', error);
      // Optionally, set an error state in the ReactiveVar:
      // this.genomeCount.set('Error'); 
    } else {
      this.genomeCount.set(result);
    }
  });
});

Template.home.onRendered(function () {
  var updatedTerms = false;
  Meteor.subscribe('newTermsAndPolicies', function () {
    if (Meteor.user()) {
      updatedTerms = Meteor.user().newTermsAndPolicies;
      Session.set('updatedTerms', updatedTerms);
    }

    dismissToast = function () {
      Meteor.call("updateNewTermsAndPolicies");
      $('.toast').fadeOut();

      setTimeout(function () {
        M.toast({ html: "Links to the terms of use and privacy policy can be found at the bottom of every page", displayLength: 5000 });
      }, 1000);
    };

    if (updatedTerms === true && $('.toast').length === 0) {
      setTimeout(function () {
        var newPrivacyPolicyToast = $("<span>We have updated our <a href='terms'>terms and privacy policy</a>. By continuing to use the software, you accept the terms and policies. <a href='' style='color: orange'><span onclick='dismissToast(); return false'>Dismiss</span></a>");
        M.toast({ html: newPrivacyPolicyToast, displayLength: 6.048e+8 }); // Hide after a week...
      }, 1000);

    }
  })

  $(document).ready(function () {
    var elems = document.querySelectorAll('.parallax');
    M.Parallax.init(elems);
  });
  $("html, body").animate({ scrollTop: 0 }, "slow");
});

Template.home.helpers({
  updatedTerms: function () {
    return Session.get('updatedTerms');
  },
  genomeCount() {
    let genomeCount = Template.instance().genomeCount.get();
    return genomeCount ? genomeCount.toLocaleString() : "";
  }
});