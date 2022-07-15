'use strict';

const ThreadBustingPlugin = require('@mailupinc/bee-emailonacid-plugin-thread-busting');
const ContentRendererPlugin = require('@mailupinc/bee-emailonacid-plugin-content-renderer');
const LocalCopyPlugin = require('@mailupinc/bee-emailonacid-plugin-local-copy');
const ContentCroppingPlugin = require('@mailupinc/bee-emailonacid-plugin-content-cropping');

function withOverridableClients(config = {}) {
  return Object.assign({}, config, {
    clients: process.env.EOA_CLIENTS
      ? process.env.EOA_CLIENTS.split(/\s{0,},\s{0,}/m)
      : config.clients,
  });
}

function withDefaultPlugins(config = {}) {
  const userPlugins = config.plugins || [];
  return Object.assign({}, config, {
    plugins: userPlugins
      .concat([
        new ThreadBustingPlugin(),
        new ContentRendererPlugin(),
        Boolean(process.env.EOA_SEND_COPY) && new LocalCopyPlugin(),
        new ContentCroppingPlugin(),
      ])
      .filter(Boolean),
  });
}

const OutputType = {
  STREAM: 0,
  LINK: 1,
};

module.exports = {
  withOverridableClients,
  withDefaultPlugins,
  OutputType,
};
