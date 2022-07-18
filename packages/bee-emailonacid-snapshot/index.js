'use strict';

const configureCreateEmail = require('./lib/create-email');
const OutputType = require('./config');

module.exports = {
  OutputType,
  createEmail: configureCreateEmail(),
  configureCreateEmail,
};
