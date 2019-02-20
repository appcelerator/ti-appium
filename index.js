'use strict';

const output = require('./src/output.js');

exports.info = output.info;
exports.step = output.step;
exports.skip = output.skip;
exports.error = output.error;
exports.debug = output.debug;
exports.banner = output.banner;
exports.finish = output.finish;

exports.appcRun = require('./src/appcelerator.js').runner;
exports.buildApp = require('./src/appcelerator.js').build;
exports.createAppPath = require('./src/appcelerator.js').createAppPath;

exports.appcSetup = async (conf, env, { ti = false } = {}) => {
	const appc = require('./src/appcelerator.js');

	try {
		let appcSDK;

		if (ti) {
			appcSDK = await appc.installSDK(conf, { ti: ti });
		} else {
			await appc.login(conf, env);

			await appc.installCLI(conf);

			appcSDK = await appc.installSDK(conf);
		}

		return appcSDK;
	} catch (err) {
		throw err;
	}
};

exports.stopAppium = require('./src/appium.js').quitServ;
exports.stopClient = require('./src/appium.js').stopClient;
exports.startAppium = require('./src/appium.js').runAppium;
exports.startClient = require('./src/appium.js').startClient;

exports.test = async (dir, modRoot) => {
	const
		path = require('path'),
		mocha = require('./src/mocha.js');

	try {
		output.banner(`Running test directory ${path.basename(dir)}`);

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

exports.bootEmulator = require('./src/device.js').launchEmu;
exports.killEmulator = require('./src/device.js').killEmu;
exports.killSimulator = require('./src/device.js').killSim;
exports.getCert = require('./src/device.js').getCert;
exports.getProfile = require('./src/device.js').getProfile;
