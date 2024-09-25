// src/main.ts

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { chromium } from 'playwright';
import { processRooms } from './processRooms';

interface ConfigInterface {
  numberOfVacantRooms: number,
  roomTypeText: string,
  chatGroupName: string,
  messageIdentifier: string,
  messageCheckIntervalMs: number,
  responseText: string,
  responseLimit: number,
  responseWindowMinutes: number,
  isOptimistic: boolean,
  inputSelectorElement: string,
}

// Resolve the path to config.yml
const config = yaml.load(fs.readFileSync(path.resolve(__dirname, 'config.yml'), 'utf8')) as ConfigInterface; // mac
// const configPath = path.resolve(process.execPath, '../config.yml'); // windows
//
// // Load the YAML configuration file
// let config: ConfigInterface;
// try {
//   config = yaml.load(fs.readFileSync(configPath, 'utf8')) as ConfigInterface;
// } catch (err) {
//   console.error(`Failed to load config file at ${configPath}:`, err);
//   process.exit(1);
// }

// Function to validate config
function validateConfig(config: any): void {
  const requiredConfig = {
    numberOfVacantRooms: 'number',
    roomTypeText: 'string',
    chatGroupName: 'string',
    messageIdentifier: 'string',
    messageCheckIntervalMs: 'number',
    responseText: 'string',
    responseLimit: 'number',
    responseWindowMinutes: 'number',
    isOptimistic: 'boolean',
    inputSelectorElement: 'string',
  };

  for (const [key, type] of Object.entries(requiredConfig)) {
    if (!(key in config)) {
      throw new Error(`Configuration error: Missing required config key "${key}"`);
    }
    if (typeof config[key] !== type) {
      throw new Error(`Configuration error: Config key "${key}" should be of type "${type}"`);
    }
  }
}

/*
Logging Feature
 */

// Define the log file path (you can customize this)
const logFilePath = path.join(__dirname, 'logs.txt');

// Create a writable stream that appends to the log file
const logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });  // 'a' stands for append mode

// Function to log to both console and file
function logToFile(...messages: any[]): void {
  const timestamp = new Date().toLocaleString(); // Get a timestamp for each log
  const formattedMessage = `[${timestamp}] ${messages.join(' ')}\n`; // Format the message with a timestamp

  // Log to the console
  console.log(...messages);  // Keeps default console behavior

  // Write the log message to the file
  try {
    logFileStream.write(formattedMessage);
  } catch (e) {
    console.log(e);
  }
}

// Validate the loaded config
validateConfig(config);

// Function to save the updated config to config.yml
// function saveConfig() { // windows
//   fs.writeFileSync(configPath, yaml.dump(config), 'utf8');
// }

function saveConfig() {
  fs.writeFileSync(path.resolve(__dirname, 'config.yml'), yaml.dump(config), 'utf8');
}


function meetsCriteriaToRespond(text: string): boolean {
  const upperCasedText = text.toUpperCase();
  const roomTypeText = config.roomTypeText.toUpperCase();

  // checks if it has the messageIdentifier
  if (upperCasedText.includes(config.messageIdentifier)) {
    if (upperCasedText.includes(roomTypeText)) {
      return true;
    }
  }
  return config.isOptimistic;
}


async function startWhatsAppBot() {
  // Specify the path to the Chrome user data directory in the local directory
  const userDataDir = path.resolve(process.execPath, '../chrome-user-data');

  // Launch browser with persistent context
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
  });

  const page = await browser.newPage();
  await page.goto('https://web.whatsapp.com');

  // Wait for the QR code to disappear, indicating login
  try {
    await page.waitForSelector('h1', { state: 'visible', timeout: 60000 });
    const h1Text = await page.$eval('h1', element => element.textContent?.trim());
    if (h1Text === 'Download WhatsApp for Mac') {
      logToFile('Logged in successfully.');
    }
    // await page.waitForSelector('h1[text()="Download WhatsApp for Mac"]', { timeout: 60000 });
  } catch (e) {
    logToFile('Please scan the QR code to log in.');
    await page.waitForSelector('h1', { state: 'visible', timeout: 60000 });
    const h1Text = await page.$eval('h1', element => element.textContent?.trim());
    if (h1Text === 'Download WhatsApp for Mac') {
      logToFile('Logged in successfully after scanning QR code.');
    }
  }
  // Locate the group chat by its name
  await page.locator(`:text("${config.chatGroupName}")`).click();

  const processedMessages = new Set<string>();
  const inputSelector = config.inputSelectorElement;
  const response = config.responseText;
  let responseCount = 0;
  let lastResponseTime = Date.now() - config.responseWindowMinutes;

  // Main loop to read messages and respond
  while (true) {
    // wait for text to appear
    await page.waitForSelector('div.message-in span.selectable-text', { state: 'visible', timeout: 60000 });

    const messages = await page.$$eval('div.message-in span.selectable-text', elements => elements.map(element => element.textContent));
    const lastMessage = messages[messages.length - 1];

    if (lastMessage === null) {
      continue;
    }

    // Generate a unique hash for the message
    const hash = crypto.createHash('sha256').update(lastMessage).digest('hex');
    if (
      !processedMessages.has(hash)
      && meetsCriteriaToRespond(lastMessage)
    ) {
      // Check if within the response limit window
      const currentTime = Date.now();
      if (currentTime - lastResponseTime > config.responseWindowMinutes) {
        // Reset count and time window if outside the limit window
        responseCount = 0;
        lastResponseTime = currentTime;
      }

      if (responseCount < config.responseLimit) {
        processedMessages.add(hash);
        // new message
        const requestedRooms = processRooms(lastMessage, config.roomTypeText);
        if (requestedRooms !== 0) {
          if (config.numberOfVacantRooms === 0) {
            logToFile('There are no more vacancies. Please reconfigure numberOfVacantRooms field and restart service.');
            continue; // to skip everything else
          }
          if (requestedRooms > config.numberOfVacantRooms) {
            // respond
            const remainingRoomResponse = `${response} ${config.numberOfVacantRooms} ROOMS`;
            await page.waitForSelector(inputSelector);
            await page.type(inputSelector, remainingRoomResponse);
            await page.keyboard.press('Enter');
            // Increment response count and update last response time
            responseCount++;
            lastResponseTime = currentTime;
            // Update vacant rooms in config
            logToFile(`Assigning remaining rooms of ${config.numberOfVacantRooms} to request of ${requestedRooms} @ ${new Date(lastResponseTime).toLocaleString()}. Please reconfigure numberOfVacantRooms field and restart service.`);

            config.numberOfVacantRooms = 0;
            // Save updated config to file
            saveConfig();
            continue;
          } else {
            // respond
            await page.waitForSelector(inputSelector);
            await page.type(inputSelector, response);
            await page.keyboard.press('Enter');
            // Increment response count and update last response time
            responseCount++;
            lastResponseTime = currentTime;
            // Update vacant rooms in config
            config.numberOfVacantRooms -= requestedRooms;
            // Save updated config to file
            saveConfig();
            logToFile(`Responded to request of ${requestedRooms} @ ${new Date(lastResponseTime).toLocaleString()}. ${config.numberOfVacantRooms} rooms remaining.`)
            continue;
          }
        }
        // logToFile('Did nothing because failed to obtain number of rooms');
        // do nothing if we cannot tell how many rooms
      } else {
        logToFile('Response limit reached. Waiting for the next window...');
      }
    }
    // Wait for new messages
    await new Promise(resolve => setTimeout(resolve, config.messageCheckIntervalMs));
  }

}

startWhatsAppBot().catch((e) => {
  logToFile(e);
  console.error(e);
});
