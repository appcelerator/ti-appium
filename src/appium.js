'use strict';

const
	wd = require('wd'),
	chai = require('chai'),
	appium = require('appium'),
	output = require('./output.js'),
	webdriver = require('./webdriver.js'),
	chaiAsPromised = require('chai-as-promised');

/**
 * @class Appium_Helper
 * @desc
 * Functions for handling the Appium server and client sessions.
 */
class Appium_Helper {
	/**
	 * Starts a WD session on the device, using the given capability requirements
	 * as Appium configuration.
	 *
	 * @param {Object} capabilities - Desired capabilities for Appium to run with
	 */
	static startClient(capabilities) {
		return new Promise(async (resolve, reject) => {
			output.debug('Starting WebDriver Instance');

			if (!capabilities.automationName) {
				switch (capabilities.platformName) {
					case 'iOS':
						capabilities.automationName = 'XCUITest';
						break;

					case 'Android':
						capabilities.automationName = 'UiAutomator2';
						break;

					default:
						capabilities.automationName = 'Appium';
						break;
				}
			}

			if (!capabilities.deviceReadyTimeout && capabilities.platformName === 'Android') {
				capabilities.deviceReadyTimeout = 60;
			}

			// Sets the amount of time Appium waits before shutting down in the background
			if (!capabilities.newCommandTimeout) {
				capabilities.newCommandTimeout = (60 * 10);
			}

			// Enabling chai assertion style: https://www.npmjs.com/package/chai-as-promised#node
			chai.use(chaiAsPromised);
			chai.should();

			// Enables chai assertion chaining
			chaiAsPromised.transferPromiseness = wd.transferPromiseness;

			// Establish the testing driver
			let driver = wd.promiseChainRemote({ host: this.host, port: this.port });

			// Make sure to include the custom commands defined in the WebDriver Helper
			webdriver.loadDriverCommands(driver, wd);

			global.driver = driver;
			global.webdriver = wd;

			driver.init(capabilities, err => {
				(err) ? reject(err) : resolve();
			});
		});
	}

	/**
	 * Stops the WD session, but first it closes and removes the app from the
	 * device in an attempt to save storage space.
	 */
	static async stopClient() {
		output.debug('Stopping WebDriver Instance');

		const driver = global.driver;

		if (driver) {
			const
				capabilities = await driver.sessionCapabilities(),
				platform = capabilities.platformName;

			output.debug('Closing the application');
			await driver.closeApp();

			if (platform === 'Android' || platform === 'iOS') {
				output.debug('Removing the app from device');
				await driver.removeApp((platform === 'iOS') ? capabilities.CFBundleIdentifier : capabilities.desired.appPackage);
			}

			output.debug('Exiting the WebDriver session');
			await driver.quit();

			delete global.driver;
		}
	}

	/**
	 * Launch an Appium server for the mobile testing, as it cannot use the
	 * desktop session.
	 *
	 * @param {String} modRoot - The path to the root of the project being tested
	 * @param {Object} opts - Optional arguments
	 * @param {String} opts.hostname - The address of the Appium server to connect to
	 * @param {Int} opts.port - The port of the server that the Appium server is running on
	 */
	static async runAppium(modRoot, { hostname = 'localhost', port = 4723 } = {}) {
		output.debug(`Starting Appium Server On '${hostname}:${port}'`);
		// We only want to allow starting a server on the local machine
		const validAddresses = [ 'localhost', '0.0.0.0', '127.0.0.1' ];

		if (validAddresses.includes(hostname)) {
			this.server = await appium.main({ host: hostname, port: port, loglevel: 'false', defaultCapabilities: { showIOSLog: true } });
			this.host = hostname;
			this.port = port;
		} else {
			throw Error('Connecting to an External Appium Server is Not Currently Supported');
		}
	}

	/**
	 * Tells the Appium server to shut down
	 */
	static async quitServ() {
		output.debug('Stopping Appium Server');

		try {
			if (this.server) {
				output.debug('Found running Appium Instance');
				await this.server.close();

				output.debug('Clearing class variables');
				delete this.server;
				delete this.host;
				delete this.port;
			} else {
				throw Error('Appium server not found!');
			}
		} catch (e) {
			throw e;
		}
	}
}

module.exports = Appium_Helper;
