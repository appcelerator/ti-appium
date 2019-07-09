'use strict';

const
	mocha = require('./src/mocha.js'),
	output = require('./src/output.js');

/**
 * @function info
 * @desc
 * Writes a message with a green info tag (note no new line is passed by
 * default).
 *
 * @param {String} message - A string to be output after the info tag
 */
exports.info = output.info;

/**
 * @function step
 * @desc
 * Writes a message with a green info tag (note no new line is passed by
 * default).
 *
 * @param {String} message - A string to be output after the info tag
 */
exports.step = output.step;

/**
 * @function skip
 * @desc
 * Writes a yellow skip to the console and resolves the promise if passed.
 *
 * @param {Function} done - Promise callback passed from the function
 * @param {Object} value - An object to be returned with resolve
 */
exports.skip = output.skip;

/**
 * @function error
 * @desc
 * Outputs all of a string in red.
 *
 * @param {String} message - String to be output
 */
exports.error = output.error;

/**
 * @function debug
 * @desc
 * Outputs a message when the debug flag is used.
 *
 * @param {String} message - String to be output
 */
exports.debug = output.debug;

/**
 * @function warn
 * @desc
 * Outputs a message when the warn flag is used.
 *
 * @param {String} message - String to be output
 */
exports.warn = output.warn;

/**
 * @function banner
 * @desc
 * Creates a banner and a green info tag around a message.
 *
 * @param {String} message - String to be enclosed by the banner
 */
exports.banner = output.banner;

/**
 * @function finish
 * @desc
 * Writes a green done to the console and resolves the promise if passed.
 *
 * @param {Function} done - Promise callback passed from the function
 * @param {Object} value - An object to be returned with resolve
 */
exports.finish = output.finish;

/**
 * @function appcRun
 * @desc
 * Build a specified application for a given platform. Also allows users to
 * specify their own arguments
 *
 * @param {String} args - Arguments to be run after calling appc
 * @param {function} matcher - A function that can be used to resolve
 */
exports.appcRun = require('./src/appcelerator.js').runner;

/**
 * @function buildApp
 * @desc
 * Build a specified application for a given platform. Also allows users to
 * specify their own arguments.
 *
 * @param {String} dir - The path to the application root
 * @param {String} platform - The mobile OS the app is being built for
 * @param {Array} args - Any additional arguments to be passed to the command
 */
exports.buildApp = require('./src/appcelerator.js').build;

/**
 * @function createAppPath
 * @desc
 * Generate a path to the built application based upon platform
 *
 * @param {String} dir - The path to the root of the application project
 * @param {String} platform - The relevant mobile OS
 * @param {String} appName - The name of the app to identify the app package
 */
exports.createAppPath = require('./src/appcelerator.js').createAppPath;

/**
 * Configure the environment with the required SDK and CLI for the Test run
 *
 * @param {Object} conf - Object for Appc setup
 * @param {String} conf.username - Appcelerator user to login with
 * @param {String} conf.password - Appcelerator password to authenticate
 * @param {String} conf.organisation - The org you want to lo in to
 * @param {String} conf.cli - The Appcelerator CLI version to use
 * @param {String} cinf.sdk - The SDK version or branch to build with
 * @param {String} env - The environment to use (Production, PreProduction)
 * @param {Object} args - Arguments
 * @param {String[]} args.args - Additional CLI arguments to be run
 * @param {Boolean} args.ti - Whether or not to use the titanium CLI over appc
 */
exports.appcSetup = async (conf, env, { args = [], ti = false } = {}) => {
	const appc = require('./src/appcelerator.js');

	try {
		let appcSDK;

		if (ti) {
			appcSDK = await appc.installSDK(conf, { args: args, ti: ti });
		} else {
			await appc.login(conf, env);

			await appc.installCLI(conf);

			appcSDK = await appc.installSDK(conf, { args: args });
		}

		return appcSDK;
	} catch (err) {
		throw err;
	}
};

/**
 * @function stopAppium
 * @desc
 * Tells the Appium server to shut down
 */
exports.stopAppium = require('./src/appium.js').quitServ;

/**
 * @function stopClient
 * @desc
 * Stops the WD session, but first it closes and removes the app from the
 * device in an attempt to save storage space.
 */
exports.stopClient = require('./src/appium.js').stopClient;

/**
 * @function startAppium
 * @desc
 * Launch an Appium server for the mobile testing, as it cannot use the
 * desktop session.
 *
 * @param {String} modRoot - The path to the root of the project being tested
 * @param {Object} args - Arguments
 * @param {String} args.hostname - The address of the Appium server to connect to
 * @param {Int} args.port - The port of the server that the Appium server is running on
 */
exports.startAppium = require('./src/appium.js').runAppium;

/**
 * @function startClient
 * @desc
 * Starts a WD session on the device, using the given capability requirements
 * as Appium configuration.
 *
 * @param {Object} capabilities - Desired capabilities for Appium to run with
 */
exports.startClient = require('./src/appium.js').startClient;

/**
 * Launch the Mocha test run on the collected files
 *
 * @param {String} dir - The directory containing the test files
 * @param {String} modRoot - The root of the project being run
 */
exports.test = async (dir, modRoot) => {
	try {
		let tests = await mocha.collectTests(dir);

		// Break here if no tests are defined
		if (tests.length === 0) {
			throw Error('No Tests Found!');
		}

		const results = await mocha.run(tests, modRoot);

		return results;
	} catch (err) {
		throw err;
	}
};

/**
 * @function bootEmulator
 * @desc
 * Launch the emulator specified in the Test_Config.js for the current test
 *
 * @param {String} deviceName - The name of the AVD emulator used for testing
 * @param {String[]} args - Additional AVD arguments to boot emulator with
 * @param {int} firstCheck - Time until the first emulator check is made (ms)
 * @param {int} freqCheck - Time between the emulator checks being made (ms)
 */
exports.bootEmulator = require('./src/device.js').launchEmu;

/**
 * @function killEmulator
 * @desc
 * Kill all the Android emulators.
 *
 * @param {String} deviceName - The name of the Android device to kill
 */
exports.killEmulator = require('./src/device.js').killEmu;

/**
 * @function killSimulator
 * @desc
 * Kill all the iOS simulators using the killall command
 */
exports.killSimulator = require('./src/device.js').killSim;

/**
 * @function getCert
 * @desc
 * Use ioslib to probe the machine for a particular iOS certificate, then
 * return the certificate object.
 *
 * @param {String} type - The type of operation the cert is defined for
 * @param {String} search - Part of the cert name, used to help locate it
 */
exports.getCert = require('./src/device.js').getCert;

/**
 * @function getProfile
 * @desc
 * Use ioslib to probe the machine for a particular iOS provisioning profile,
 * then return the provisioning profile object.
 *
 * @param {String} type - The type of operation the pp is defined for
 * @param {String} search - Part of the pp name, used to help locate it
 */
exports.getProfile = require('./src/device.js').getProfile;
