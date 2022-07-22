/* eslint-disable no-console */
'use strict';

const path = require('path');
const fs = require('fs');
const {
  OutputType,
  configureCreateEmail,
} = require('./packages/bee-emailonacid-snapshot');

const content = '<html><body><h1>HELLO TEAM</h1></body></html>';
const subject = 'Local EoA test';
const htmlFile = 'output.html';

const config = {
  clients: [
    'android8',
    'iphonexr_14',
    'iphone8_outlook',
    'outlook19',
    'gmailw10_chr26_win',
  ],
  credentials: {
    apiKey: 'KilAyamoiJ8sMoH28ZGyoDBArm49OBkuUnD2s68A',
    accountPassword: 'V1LBF14JYSGTmWNghmIF',
  },
  server: 'https://api.emailonacid.com/v5',
  outputType: [OutputType.BUFFER, OutputType.LINK],
  debug: false,
  logLevel: 'info', // info, timer, debug, warn, error
  poll: { interval: 5e3, timeout: 60e3 },
  destFolder: 'out',
};

let completed = 0;
const createEmail = configureCreateEmail(config);

async function run() {
  console.log('Process is running');

  await createEmail(content, subject).then((email) => {
    return Promise.all(
      config.clients.map((client) => {
        return saveShot(email, client, htmlFile, config.destFolder)
          .then((filename) => {
            completed++;
            console.log(
              `${Math.round(
                (100 * completed) / config.clients.length
              )}% - Screenshot for ${client} taken. [${filename}]`
            );
          })
          .catch((error) => {
            console.error(
              `An error occurs while saving ${client} screenshot file`,
              error
            );
          });
      })
    ).finally(() => {
      console.log(`${config.clients} Screenshots for ${htmlFile} taken.`);
      return email.clean();
    });
  });

  console.log(
    `Took ${config.clients.length} screenshots for ${completed} files.`
  );
}

async function saveShot(email, client, name, folder) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const { stream, link } = await email.screenshot(client);
    const filename = `${folder}/${path.basename(name, '.html')}_${client}`;

    if (!stream && !link)
      reject('No image retrieved, is OutputType set correctly?');

    const lnk = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
        <dict>
          <key>URL</key>
          <string>${link}</string>
        </dict>
      </plist>`;

    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    if (stream) {
      await fs.writeFileSync(`${filename}.png`, stream, 'binary', (error) => {
        if (error) reject('Error while saving image.');
      });
    }

    if (link) {
      await fs.writeFileSync(`${filename}.webloc`, lnk, 'binary', (error) => {
        if (error) reject('Error while saving link.');
      });
    }

    resolve(filename);
  });
}

run();
