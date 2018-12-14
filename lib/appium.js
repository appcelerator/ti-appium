'use strict';

const
	wd = require('wd'),
	chai = require('chai'),
	path = require('path'),
	ps = require('ps-list'),
	ioslib = require('ioslib'),
	output = require('./output.js'),
	// Appc = require('./Appc_Helper.js'),
	spawn = require('child_process').spawn,
	device = require('./device.js'),
	exec = require('child_process').execSync,
	Webdriver = require('./webdriver.js'),
	chaiAsPromised = require('chai-as-promised');
// app = require('../Config/Test_Config.js').app;

class Appium_Helper {
	/*****************************************************************************
	 * Starts a WD session on the device, using the given capability requirements
	 * as Appium configuration
	 *
	 * @param {String} platform - The platform that is about to be launched
	 ****************************************************************************/
	static startClient(capabilities) {
		return new Promise(async (resolve, reject) => {
			output.step('Starting WebDriver Instance');

			const cap = {
				app: capabilities.app,
				platformName: capabilities.platform,
				platformVersion: capabilities.platVersion,
				deviceName: capabilities.deviceName,
				appPackage: capabilities.appPackage,
				appActivity: capabilities.appActivity
			};

			switch (capabilities.platform) {
				case 'iOS':
					// case 'iosDevice':
					// case 'simulator':
					cap.automationName = 'XCUITest';
					break;

				case 'Android':
					// case 'emulator':
					// case 'genymotion':
					// case 'androidDevice':
					// This is where an Android device need to be booted
					cap.deviceReadyTimeout = 60;
					cap.automationName = 'Appium';
					break;
			}

			// Sets the amount of time Appium waits before shutting down in the background
			cap.newCommandTimeout = (60 * 10);

			// Enabling chai assertion style: https://www.npmjs.com/package/chai-as-promised#node
			chai.use(chaiAsPromised);
			chai.should();

			// Enables chai assertion chaining
			chaiAsPromised.transferPromiseness = wd.transferPromiseness;

			// Retrieve the Appium server address and port, to setup the client
			const
				processInfo = await getAppium(),
				args = processInfo.cmd.split(' '),
				host = args[args.indexOf('-a') + 1],
				port = args[args.indexOf('-p') + 1];

			if(typeof host === 'undefined' || typeof port === 'undefined') reject('Cannot locate Appium server details');

			// Establish the testing driver
			let driver = wd.promiseChainRemote({ host: host, port: port });

			global.driver = driver;
			global.webdriver = wd;

			// Make sure to include the custom commands defined in the WebDriver Helper
			await Webdriver.loadDriverCommands(driver, wd);

			driver.init(cap, err => {
				(err) ? reject(err): output.finish(resolve);
			});
		});
	}

	/*****************************************************************************
	 * Stops the WD session, but first it closes and removes the app from the
	 * device in an attempt to save storage space
	 ****************************************************************************/
	static async stopClient(platform) {
		output.step('Stopping WebDriver Instance');

		const driver = global.driver;

		if(driver) {
			const
				capabilities = await driver.sessionCapabilities(),
				appID = capabilities.CFBundleIdentifier,
				platform = capabilities.platformName;

			output.debug('Closing the application');
			await driver.closeApp();

			output.debug('Removing the app from device');
			await driver.removeApp(appID);

			output.debug('Exiting the WebDriver session');
			await driver.quit();

			await device.killDevice(platform);

			delete global.driver;

			output.finish();
		}
	}

	/*****************************************************************************
	 * Launch an Appium server for the mobile testing, as it cannot use the
	 * desktop session
	 ****************************************************************************/
	static runAppium(hostname, portNumber) {

		const
			host = hostname || 'localhost',
			port = portNumber || 4723;

		output.step(`Starting Appium Server On '${host}:${port}'`);

		return new Promise((resolve, reject) => {
			// We only want to allow starting a server on the local machine
			const validAddresses = ['localhost', '0.0.0.0', '127.0.0.1'];

			if(validAddresses.includes(host)) {
				let exe;

				switch (process.platform) {
					case 'darwin':
						exe = 'appium';
						break;

					case 'win32':
						exe = 'appium.cmd';
						break;
				}

				let
					appiumExe = path.join(__dirname, '..', 'node_modules', '.bin', exe),
					flags = ['--log-no-colors', '-a', host, '-p', port, '--show-ios-log'];

				const appiumServer = spawn(appiumExe, flags, {
					shell: true
				});

				appiumServer.stdout.on('data', data => {
					const line = data.toString().trim();

					const
						regStr = `started on ${host}\\:${port}$`,
						isRunning = new RegExp(regStr, 'g').test(line);

					if(isRunning) {
						output.finish(resolve, appiumServer);
					}
				});

				appiumServer.stderr.on('data', data => {
					reject(data.toString());
				});

				appiumServer.on('error', err => {
					reject(err.stack);
				});
			} else {
				reject('Connecting to an External Appium Server is Not Currently Supported');
			}
		});
	}

	/*****************************************************************************
	 * Tells the Appium server to shut down
	 ****************************************************************************/
	static async quitServ() {
		output.step('Stopping Appium Server');

		const processInfo = await getAppium();

		if(processInfo) {
			output.debug(`Found Appium server PID: ${processInfo.pid}`);
		} else {
			throw Error('PID for Appium not found!');
		}

		if(process.platform === 'win32') {
			output.debug('Detected Windows, killing Appium server with taskkill command');
			await exec(`taskkill /F /PID ${processInfo.pid}`);
		} else {
			output.debug('Presuming UNIX, killing Appium server with kill command');
			await exec(`kill -9 ${processInfo.pid}`);
		}

		output.finish();
	}
}

async function getAppium() {
	const
		list = await ps(),
		appiumPath = path.join('ti-appium', 'node_modules', '.bin', 'appium'),
		processInfo = list.find(x => x.cmd.includes(appiumPath));

	return processInfo;
}

module.exports = Appium_Helper;