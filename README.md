# Phamerator

This source code powers the [phamerator.org](https://phamerator.org) comparative bacteriophage genomics platform. The code is made available primarily for those who wish to help us with development. If instead you want to use Phamerator to study your own data set, you should know that [phamerator.org](https://phamerator.org) already hosts many data sets and can host yours too. Hosted data sets can be public, shared with a team of users, or reserved just for you. For help with adding your own data set(s), please get in touch with us.

## For developers:

Install meteor by following the instructions at https://meteor.com
* `cd phamerator`
* `meteor`

Create a MongoDB index on the "Genomes" collection.
* With meteor running, open a new terminal in the phamerator subdirectory
* `meteor mongo`
* `use meteor`
* `db.genomes.createIndex({cluster:1});`

The names "Phamerator" and "Phamerator.org" are &copy; Steven Cresawn, Ph.D. 2006-2026. All rights reserved. For more information regarding Phamerator's terms of use and other policies, visit [phamerator.org/terms](https://phamerator.org/terms).
