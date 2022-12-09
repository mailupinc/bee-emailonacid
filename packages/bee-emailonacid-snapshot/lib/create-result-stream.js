'use strict';

const { OutputType } = require('./config');
const { fetch } = require('cross-fetch');
const { Readable } = require('stream');
const Jimp = require('jimp');

const COMPLETED_TIMESTAMP_HOURS_SHIFT = -7;
const SCREENSHOT_FETCH_RETRIES = 3;
const CLIENT_PROCESS_RETRIES = 3;

class ResultStream extends Readable {
  constructor(context, options) {
    super({ objectMode: true });
    this.backOffInterval = options.poll.interval;
    this.aborted = false;
    this.timeouts = [];
    this.context = context;
    this.options = options;
    this.completed = new Map();
    this.initializePolling();
  }

  // Stream hangs if not custom `_read` is provided
  _read() {}

  async initializePolling() {
    const { logger, test, options } = this.context;
    const startedAt = Date.now();
    logger.debug('polling started');
    try {
      // Track EoA-side timings
      options.clients.forEach((clientId) =>
        logger.time(`response:${clientId}`)
      );
      // Delay initial request
      await this.delayBeforeNext(true);
      // Start polling for results
      await this.startPolling();
    } catch (reason) {
      logger.error(reason);
      throw reason;
    } finally {
      // Mark stream completed
      this.push(null);
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      logger.debug('polling complete');
      logger.debug('test %s is ready in total %s seconds', test.id, elapsed);
    }
  }

  async startPolling(retriesLeft = CLIENT_PROCESS_RETRIES, lastError = null) {
    const { logger, client, test } = this.context;
    if (retriesLeft === 0) {
      throw new Error(
        `Failed to retrieve results after ${CLIENT_PROCESS_RETRIES} attempts: ${lastError}`
      );
    }
    try {
      // Avoid dead-locks
      await Promise.race([this.poll(), this.rejectAfterTimeout()]);
    } catch (error) {
      // Timeout reached but no clients. This exception should be catched externally
      if (!error.clients?.length) throw error;
      // Timeout reached, reprocess screenshot for waiting clients
      retriesLeft--;
      const clientsLeft = error.clients.join(',');
      logger.debug(
        `reprocess clients %s, attempt: %s`,
        clientsLeft,
        CLIENT_PROCESS_RETRIES - retriesLeft
      );
      await client.reprocessScreenshots(test.id, error.clients);
      logger.debug('restart polling for clients: %s', clientsLeft);
      await this.startPolling(retriesLeft, error.message);
    }
  }

  async poll() {
    const { context, options, aborted } = this;
    const { client, test } = context;
    if (aborted) return;
    // Process the result only if some progress is received
    const status = await client.getTest(test.id);
    const progressed = Boolean(
      status.completed.find((clientId) => !this.completed.has(clientId))
    );
    if (progressed) await this.progress(status);
    // Exit if all clients are ready
    if (options.clients.length === status.completed.length) return;
    await this.delayBeforeNext(progressed);
    await this.poll();
  }

  async progress(status) {
    const { logger, test, client, options } = this.context;
    logger.debug('progress update for %s', test.id);
    logger.debug(
      'processing: %s | completed: %s | bounced: %s',
      status.processing.length,
      status.completed.length,
      status.bounced.length
    );
    if (!status.completed.length) return;
    const results = await client.getResults(test.id);
    await Promise.all(
      status.completed.map(async (clientId) => {
        // Skip completed clients
        if (this.completed.has(clientId)) return;
        const result = results.find((entry) => entry.id === clientId);
        const screenshotUrl = result.screenshots.default;
        const { submitted, completed } = result.statusDetails;
        // Fix EoA's bizzare timestamp shift
        completed?.setHours(
          completed.getHours() + COMPLETED_TIMESTAMP_HOURS_SHIFT
        );
        const elapsed = Math.round((completed - submitted) / 1000);
        const attempts = result.statusDetails.attempts;
        logger.timeEnd(`response:${clientId}`);
        logger.debug(
          '%s is ready in %ss with %s attempts',
          clientId,
          elapsed,
          attempts
        );
        // Remember the result to avoid double processing
        let image;
        let src;
        if (options.outputType.includes(OutputType.BUFFER)) {
          logger.debug('fetching %s', screenshotUrl);
          image = await this.fetchScreenshot(screenshotUrl).catch((error) => {
            if (error.name === 403) error.clients = [clientId];
            throw error;
          });
        }
        if (options.outputType.includes(OutputType.LINK)) {
          logger.debug('linking %s', screenshotUrl);
          src = new URL(screenshotUrl);
        }
        this.completed.set(clientId, { image, src });
        this.push([clientId, image, src]);
      })
    );
  }

  async rejectAfterTimeout() {
    return new Promise((_, reject) => {
      this.timeouts.push(
        setTimeout(() => {
          const timeout = this.options.poll.timeout / 1000;
          const timeoutedClients = this.options.clients.filter(
            (clientId) => !this.completed.has(clientId)
          );
          const error = new Error();
          error.message = `Polling timeout of ${timeoutedClients} after ${timeout}s`;
          error.clients = timeoutedClients;
          reject(error);
        }, this.options.poll.timeout)
      );
    });
  }

  async delayBeforeNext(progressed) {
    const { logger } = this.context;
    if (!progressed) {
      this.backOffInterval += this.options.poll.interval;
      logger.debug(
        'increased poll interval to %s seconds',
        Math.round(this.backOffInterval / 1000)
      );
    }
    await new Promise((resolve) => setTimeout(resolve, this.backOffInterval));
  }

  async stopPolling() {
    this.aborted = true;
    await new Promise((resolve) => setImmediate(resolve));
    this.destroy();
    await new Promise((resolve) => setImmediate(resolve));
    this.timeouts.forEach((timeout) => timeout.unref());
    await new Promise((resolve) => setImmediate(resolve));
  }

  async fetchScreenshot(
    screenshotUrl,
    retriesLeft = SCREENSHOT_FETCH_RETRIES,
    lastError = null
  ) {
    if (retriesLeft === 0) {
      lastError.message = `Failed to fetch ${screenshotUrl} after ${SCREENSHOT_FETCH_RETRIES} attempts: ${lastError}`;
      throw lastError;
    }
    try {
      const response = await fetch(screenshotUrl);
      if (response.ok) {
        return await Jimp.read(await response.arrayBuffer());
      }
      const error = new Error();
      error.message = response.statusText;
      error.name = response.status;
      throw error;
    } catch (reason) {
      return await this.fetchScreenshot(screenshotUrl, retriesLeft - 1, reason);
    }
  }
}

function createResultStream(context, options) {
  return new ResultStream(context, options);
}

module.exports = createResultStream;
