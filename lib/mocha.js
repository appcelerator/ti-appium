'use strict';

const
	path = require('path'),
	fs = require('fs-extra'),
	Mocha = require('mocha'),
	output = require('./output.js');

class Mocha_Helper {
	/*****************************************************************************
	 * Goes through the passed directory, and extracts any tests that match the
	 * regular expression.
	 *
	 * @param {String} dir - The directory to search
	 ****************************************************************************/
	static collectTests(dir) {
		return new Promise((resolve, reject) => {
			output.step('Fetching test files');
			// Our container for all the test files to be run
			let tests = [];

			try {
				output.debug(`Searching in ${dir} for tests`);
				// Iterate through each file within the test directory
				fs.readdirSync(dir).forEach(file => {
					// Only use actual test files, ignore everything else
					if(file.match(/.+\.test\.js/g)) {
						let filePath = path.join(dir, file);

						tests.push(filePath);
					}
				});
			} catch (err) {
				reject(err);
			}

			output.debug(`Found ${tests.length} test file(s)`);

			output.finish(resolve, tests);
		});
	}

	/*****************************************************************************
	 * Runs through the Mocha tests outlined in device_config.js
	 *
	 * @param {Array} testFiles - An array of test files for Mocha to run
	 * @param {String} modRoot - The path to the root of the project being tested
	 ****************************************************************************/
	static run(testFiles, modRoot) {
		return new Promise((resolve, reject) => {
			// Have to clear cache so that Mocha will run the same tests twice, solution taken from here https://github.com/mochajs/mocha/issues/995#issuecomment-261752316
			Object.keys(require.cache).forEach((file) => {
				delete require.cache[file];
			});

			// Get the target of this test run
			const
				testPath = testFiles[0],
				testDir = path.dirname(testPath),
				testTarg = path.basename(testDir);

			// Get the current date time, to label the test run in a unique manner
			const
				moment = require('moment-timezone'),
				time = moment().format('DD-MM-YY_HH꞉mm:ss');

			// Create the labels
			const
				outDir = path.join(modRoot, 'Reports'),
				outFile = path.join(outDir, `${testTarg}_${time}.xml`);

			// Make sure our result location exists
			fs.ensureFileSync(outFile);

			output.debug(`Putting Jenkins results in ${testTarg}_${time}.xml`);

			// Create the new Mocha instance
			let mocha = new Mocha({
				fullTrace: false,
				useColors: true,
				timeout: 120000, // Maybe this should be configurable
				slow: 80000,
				reporter: 'mocha-jenkins-reporter',
				reporterOptions: {
					junit_report_name: testTarg,
					junit_report_path: outFile,
					junit_report_stack: 1
				}
			});

			// If tests are numbered, ensure they're executed in the correct order
			let collator = new Intl.Collator(undefined, {
				numeric: true,
				sensitivity: 'base'
			});

			testFiles.sort(collator.compare);

			// Add all of the test files one by one
			testFiles.forEach(file => {
				mocha.addFile(file);
			});

			// Suppress Mochas output unless user has specified logging
			const logging = process.env.logging;

			if(logging !== 'basic' && logging !== 'debug') {
				console.log = () => {}
			}

			let tests = [];

			output.info('Handing off to Mocha for testing');

			// Run the supplied test files
			try {
				mocha.run(() => {
						if(logging !== 'basic' || logging !== 'debug') {
							delete console.log;
						}

						output.debug('Tests complete, exiting Mocha');

						resolve(tests);
					})
					.on('test end', data => {
						try {
							// Attempt to pull the name of the ticket using the file path of the test
							let
								test,
								testNumber = parseInt(path.basename(data.file, '.js').split('.')[0], 10),
								index = tests.indexOf(tests.find(x => x.testNum === testNumber));

							if(data.pending === true) {
								// Check if the ticket is already in the array
								if(index > 0) {
									// Add the skip message onto the object
									tests[index].errors.push(data.title.replace(/\\/g, '').replace(/"/g, '\''));
								} else {
									// If a ticket object isn't already in the array, create it
									test = {
										state: 3,
										name: data.title,
										testNum: testNumber,
										errors: [data.title.replace(/\\/g, '').replace(/"/g, '\'')]
									};
								}
							} else if(data.state === 'passed') {
								// Check if the ticket is already in the array
								if(index > 0) {
									// Change the state of the test to a pass if it was previously skipped
									if(tests[index].state === 3) {
										tests[index].state = 1;
									}
								} else {
									// Create a new ticket object if one doesn't exist
									test = {
										state: 1,
										name: data.title,
										testNum: testNumber,
										errors: []
									};
								}
							} else if(data.state === 'failed') {
								// Create a message to be attatched to the ticket
								let failMessage = `[TEST STEP] ${data.title.replace(/"/g, '\'')}\\n[RESULT] ${data.err.message.replace(/\\/g, '').replace(/"/g, '\'')}`;
								// Check if the ticket is already in the array
								if(index > 0) {
									// Change the state of the test to a failure
									tests[index].state = 2;
									// Add the error into the array
									tests[index].errors.push(failMessage);
								} else {
									// Create a new ticket object if one doesn't exist
									test = {
										state: 2,
										name: data.title,
										testNum: testNumber,
										errors: [failMessage]
									};
								}
							}

							if(test) {
								tests.push(test);
							}

						} catch (err) {
							output.error(err);
						}
					});
			} catch (err) {
				reject('Issue on Mocha run');
			}
		});
	}
}

module.exports = Mocha_Helper;