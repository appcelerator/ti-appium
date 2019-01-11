'use strict';

const output = require('./lib/output.js');

exports.info = output.info;
exports.error = output.error;

exports.appcRun = require('./lib/appcelerator.js').runner;

exports.buildApp = require('./lib/appcelerator.js').build;

exports.createAppPath = require('./lib/appcelerator.js').createAppPath;

exports.appcSetup = async (conf) => {
	const appc = require('./lib/appcelerator.js');

	try {
		await appc.login(conf, 'production');

		await appc.installCLI(conf);

		await appc.installSDK(conf);
	} catch (err) {
		throw err;
	}
}

exports.stopAppium = require('./lib/appium.js').quitServ;

exports.stopClient = require('./lib/appium.js').stopClient;

exports.startAppium = require('./lib/appium.js').runAppium;

exports.startClient = require('./lib/appium.js').startClient;

exports.test = async (dir) => {
	const
		path = require('path'),
		mocha = require('./lib/mocha.js');

	try {
		output.banner(`Running test directory ${path.basename(dir)}`);

		let tests = await mocha.collectTests(dir);

		// Break here if no tests are defined
		if(tests.length === 0) throw Error('No Tests Found!');

		await mocha.run(tests);
	} catch (err) {
		throw err;
	}
}