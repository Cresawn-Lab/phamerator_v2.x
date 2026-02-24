Template.terms.onRendered(function () {
  $('.toast').fadeOut()
  setTimeout(function () {
    M.toast({ html: "Links to the terms of use and privacy policy can be found at the bottom of every page", displayLength: 3000 });
  }, 1000);
  $("html, body").animate({ scrollTop: 0 }, "slow");
});
