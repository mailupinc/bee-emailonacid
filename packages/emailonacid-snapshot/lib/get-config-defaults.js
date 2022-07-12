'use strict';

const {
  withOverridableClients,
  withDefaultPlugins,
  OutputType,
} = require('./config');

function getConfigDefaults() {
  return withDefaultPlugins(
    withOverridableClients({
      clients: ['iphone12_15', 'ipadpro_12_15', 'applemail13'],
      credentials: {
        apiKey: process.env.EOA_API_KEY,
        accountPassword: process.env.EOA_ACCOUNT_PASSWORD,
      },
      debug: Boolean(process.env.DEBUG) || Boolean(process.env.EOA_DEBUG),
      plugins: [],
      server: process.env.EOA_SERVER_ADDRESS,
      poll: { interval: 5e3, timeout: 120e3 },
      outputType: [OutputType.STREAM],
    })
  );
}

module.exports = getConfigDefaults;
