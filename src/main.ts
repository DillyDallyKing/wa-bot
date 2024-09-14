// src/main.ts

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { chromium } from 'playwright';

interface ConfigInterface {
  numberOfVacantRooms: number,
  chatGroupName: string,
  baseCriteria: string,
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
    chatGroupName: 'string',
    baseCriteria: 'string',
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

// Validate the loaded config
validateConfig(config);

// Function to save the updated config to config.yml
// function saveConfig() { // windows
//   fs.writeFileSync(configPath, yaml.dump(config), 'utf8');
// }

function saveConfig() {
  fs.writeFileSync(path.resolve(__dirname, 'config.yml'), yaml.dump(config), 'utf8');
}

function getNumberOfRooms(text: string): number | null {
  const roomRegex = /NO\. OF ROOMS\s+(\d+)\s*ROOMS?\s*\(\s*ECONOMY\s*\)/i;
  const match = text.match(roomRegex);
  if (match && match[1]) {
    const numberOfRoomsStr = match[1];
    const numberOfRooms = parseInt(numberOfRoomsStr, 10);
    return numberOfRooms;
  }
  return null;
}

function meetsCriteriaToRespond(text: string): boolean {
  const upperCasedText = text.toUpperCase();

  // checks if it has the baseCriteria
  if (upperCasedText.includes(config.baseCriteria)) {
    if (upperCasedText.includes('ECONOMY')) {
      console.log('met', 'economy', true);
      return true;
    }
  }
  console.log('unmet', config.isOptimistic);
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

  // Function to select the chat group
  async function selectChatGroup() {
    await page.click(`span[title="${config.chatGroupName}"]`);
    await page.waitForSelector(`span[title="${config.chatGroupName}"]`);
    await page.click(`span[title="${config.chatGroupName}"]`);
    console.log(`Opened group chat: ${config.chatGroupName}`);
  }

  // Wait for the QR code to disappear, indicating login
  try {
    await page.waitForSelector('h1', { state: 'visible', timeout: 60000 });
    const h1Text = await page.$eval('h1', element => element.textContent?.trim());
    if (h1Text === 'Download WhatsApp for Mac') {
      console.log('Logged in successfully.');
    }
    // await page.waitForSelector('h1[text()="Download WhatsApp for Mac"]', { timeout: 60000 });
  } catch (e) {
    console.log('Please scan the QR code to log in.');
    await page.waitForSelector('h1', { state: 'visible', timeout: 60000 });
    const h1Text = await page.$eval('h1', element => element.textContent?.trim());
    if (h1Text === 'Download WhatsApp for Mac') {
      console.log('Logged in successfully after scanning QR code.');
    }
  }
  // Locate the group chat by its name
  await page.click(`span[title="${config.chatGroupName}"]`);

  const processedMessages = new Set<string>();
  const inputSelector = config.inputSelectorElement;
  let responseCount = 0;
  let lastResponseTime = Date.now() - config.responseWindowMinutes;

  // Main loop to read messages and respond
  while (true) {
    // wait for text to appear
    await page.waitForSelector('div.message-in span.selectable-text', { state: 'visible', timeout: 60000 });

    // Check if the current chat group is the specified group
    const currentGroup = await page.$eval('div._amif span._ao3e', el => el.textContent);
    if (currentGroup !== config.chatGroupName) {
      console.log(`Current group (${currentGroup}) is not the specified group (${config.chatGroupName}). Re-selecting...`);
      await selectChatGroup();
    }


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
        // new message
        const requestedRooms = getNumberOfRooms(lastMessage);
        if (requestedRooms !== null) {
          // Check if there are enough vacant rooms
          if (config.numberOfVacantRooms >= requestedRooms) {
            // Update vacant rooms in config
            config.numberOfVacantRooms -= requestedRooms;
            // Save updated config to file
            saveConfig();

            // Respond to the last message
            const response = config.responseText;
            processedMessages.add(hash);
            // respond
            await page.waitForSelector(inputSelector);
            await page.type(inputSelector, response);
            await page.keyboard.press('Enter');
            // Increment response count and update last response time
            responseCount++;
            lastResponseTime = Date.now();
          } else {
            processedMessages.add(hash);
            console.log('Insufficient vacant rooms. Not responding.');
          }
        }
      } else {
        console.log('Response limit reached. Waiting for the next window...');
      }
    }
    // Wait for new messages
    await new Promise(resolve => setTimeout(resolve, config.messageCheckIntervalMs));
  }

}

startWhatsAppBot().catch(console.error);
