'use strict';

const output = require('./lib/output.js');

exports.appcSetup = async (conf) => {
	const appc = require('./lib/appcelerator.js');

	let
		sdk,
		appiumServer;

	try {
		await appc.login(conf, 'production');

		await appc.installCLI(conf);

		sdk = await appc.installSDK(conf);
	} catch (err) {
		output.error(err);
		process.exit();
	}
}

exports.startAppium = async (hostname, portNumber) => {
	const appium = require('./lib/appium.js');

	try {
		await appium.runAppium(hostname, portNumber);
	} catch (err) {
		output.error(err);
		process.exit();
	}
}

exports.stopAppium = async () => {
	const appium = require('./lib/appium.js');

	try {
		await appium.quitServ();
	} catch (err) {
		output.error(err);
		process.exit();
	}
}

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
		output.error(err);
		process.exit();
	}
}

exports.buildApp = async (dir, platform, args) => {
	const appc = require('./lib/appcelerator.js');

	try {
		await appc.build(dir, platform, args);
	} catch (err) {
		output.error(err);
		process.exit();
	}
}

exports.startClient = async () => {
	const appium = require('./lib/appium.js');

	try {
		await appium.startClient();
	} catch (err) {
		output.error(err);
		process.exit();
	}
}