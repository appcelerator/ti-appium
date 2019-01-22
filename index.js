'use strict';

const output = require('./src/output.js');

exports.info = output.info;
exports.error = output.error;

exports.appcRun = require('./src/appcelerator.js').runner;

exports.buildApp = require('./src/appcelerator.js').build;

exports.createAppPath = require('./src/appcelerator.js').createAppPath;

exports.appcSetup = async (conf) => {
	const appc = require('./src/appcelerator.js');

	try {
		await appc.login(conf, 'production');

		await appc.installCLI(conf);

		await appc.installSDK(conf);
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

		await mocha.run(tests, modRoot);
	} catch (err) {
		throw err;
	}
};

exports.bootEmulator = require('./src/device.js').launchEmu;

exports.killEmulator = require('./src/device.js').killEmu;

exports.killSimulator = require('./src/device.js').killSim;
