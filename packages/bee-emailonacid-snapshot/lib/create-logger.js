'use strict';

const { Signale } = require('signale');

function createLogger(options) {
  return new Signale({
    config: {
      displayTimestamp: false,
      underlineMessage: false,
      displayLabel: false,
    },
    scope: 'emailonacid',
    interactive: false,
    stream: options.debug ? options.stream || [process.stdout] : [],
    logLevel: options.logLevel,
  });
}

module.exports = createLogger;
