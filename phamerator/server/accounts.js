// ensure that all accounts have all needed fields
Meteor.startup(async function () {
  Accounts.onLogout(function () {
  })
  // get all datasets
  var datasets = await Datasets.find().fetchAsync();

  // for each dataset, ensure that the owner has "view", "edit", and "share" roles
  // for each dataset
  datasets.forEach(function (dataset) {

  });

})
