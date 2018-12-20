'use strict';

const
	wd = require('wd'),
	chai = require('chai'),
	path = require('path'),
	ps = require('ps-list'),
	ioslib = require('ioslib'),
	output = require('./output.js'),
	device = require('./device.js'),
	webdriver = require('./webdriver.js'),
	spawn = require('child_process').spawn,
	exec = require('child_process').execSync,
	chaiAsPromised = require('chai-as-promised');

class Appium_Helper {
	/*****************************************************************************
	 * Starts a WD session on the device, using the given capability requirements
	 * as Appium configuration.
	 *
	 * @param {Object} capabilities - Desired options for Appium to run with
	 ****************************************************************************/
	static startClient(capabilities) {
		return new Promise(async (resolve, reject) => {
			output.step('Starting WebDriver Instance');

			switch (capabilities.platform) {
			case 'iOS':
				capabilities.automationName = 'XCUITest';
				break;

			case 'Android':
				capabilities.deviceReadyTimeout = 60;
				capabilities.automationName = 'Appium';
				await device.launchEmu(capabilities.deviceName);
				break;
			}

			// Sets the amount of time Appium waits before shutting down in the background
			capabilities.newCommandTimeout = (60 * 10);

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
			await webdriver.loadDriverCommands(driver, wd);

			driver.init(capabilities, err => {
				(err) ? reject(err): output.finish(resolve);
			});
		});
	}

	/*****************************************************************************
	 * Stops the WD session, but first it closes and removes the app from the
	 * device in an attempt to save storage space.
	 ****************************************************************************/
	static async stopClient() {
		output.step('Stopping WebDriver Instance');

		const driver = global.driver;

		if(driver) {
			const
				capabilities = await driver.sessionCapabilities(),
				platform = capabilities.platformName;

			output.debug('Closing the application');
			await driver.closeApp();


			if(platform === 'Android' || platform === 'iOS') {
				output.debug('Removing the app from device');
				await driver.removeApp((platform === 'iOS') ? capabilities.CFBundleIdentifier : capabilities.desired.appPackage);
			}

			output.debug('Exiting the WebDriver session');
			await driver.quit();

			await device.killDevice(platform, (platform === 'Android') ? capabilities.desired.deviceName : undefined);

			delete global.driver;

			output.finish();
		}
	}

	/*****************************************************************************
	 * Launch an Appium server for the mobile testing, as it cannot use the
	 * desktop session.
	 *
	 * @param {String} hostname - The address to launch the Appium server on
	 * @param {int} portNumber - The port to open for the Appium server
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

/*****************************************************************************
 * Retrieves the PID for the Appium server from a list of running processes
 ****************************************************************************/
async function getAppium() {
	const
		list = await ps(),
		appiumPath = path.join('ti-appium', 'node_modules', '.bin', 'appium'),
		processInfo = list.find(x => x.cmd.includes(appiumPath));

	return processInfo;
}

module.exports = Appium_Helper;