const { join, relative } = require('path');
const {
  createEmulator,
  createServer,
} = require('@mailupinc/bee-emailonacid-emulator/standalone');
const { configureCreateEmail } = require('../');
const { OutputType } = require('../config');

jest.unmock('cross-fetch');

describe('polling', () => {
  const emulator = createEmulator();
  const fixtures = createServer();
  const pathToFixture = (resource) => {
    return relative(process.cwd(), join(__dirname, '__fixtures__', resource));
  };

  beforeAll(fixtures.start);
  beforeAll(emulator.start);
  afterEach(emulator.resetState);
  afterEach(jest.resetAllMocks);
  afterAll(emulator.stop);
  afterAll(fixtures.stop);

  it.each(['android6', 'outlook07'])(
    'polls the result: %s',
    async (clientName) => {
      jest.setTimeout(1.5 * 60 * 1000);

      const createEmail = configureCreateEmail({
        credentials: { apiKey: 'sandbox', accountPassword: 'sandbox' },
        clients: [clientName],
        server: emulator.url,
        outputType: [OutputType.STREAM, OutputType.LINK],
      });
      // Set available clients
      emulator.setState({
        availableClients: {
          [clientName]: { id: clientName },
        },
      });
      const email = await createEmail('');
      // Set desired result
      const imageUrl = [
        fixtures.url,
        pathToFixture(`polling-polls-the-result-${clientName}.png`),
      ].join('/');

      emulator.setState({
        results: {
          [email.id]: {
            [clientName]: {
              screenshots: {
                default: imageUrl,
              },
              status_details: {
                // Simulate EoA's time shift bug
                completed:
                  new Date().setHours(new Date().getHours() + 7) / 1000,
              },
            },
          },
        },
      });
      const results = await email.screenshot(clientName);
      expect(results.stream).toMatchImageSnapshot();
      expect(results.link.href).toEqual(new URL(imageUrl).href);
    }
  );
});

/* eslint-env jest */
/* eslint camelcase: off */
