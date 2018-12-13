'use strict';

const
	path = require('path'),
	fs = require('fs-extra'),
	PNGCrop = require('png-crop'),
	output = require('./output.js'),
	resemble = require('node-resemble-js');

class WebDriver_Helper {
	static loadDriverCommands(driver, webdriver) {
		return new Promise(resolve => {
			output.debug('Loading in custom WebDriver commands');

			webdriver.addPromiseMethod('screenshotTest', (ticket, number, directory, thresh) => {
				return new Promise((resolve, reject) => {
					driver.sessions()
						.then(sessions => {
							const platform = sessions[0].capabilities.platformName;

							switch (platform) {
							case 'iOS':
								// Get the size of the window frame
								driver
									.elementByClassName('XCUIElementTypeApplication')
									.getSize()
									.then(windowSize => {
										// Get the size of the status bar
										driver
											.elementByClassName('XCUIElementTypeStatusBar')
											.getSize()
											.then(statusSize => {
												// Create the config for PNGCrop to use
												let dimensions = {
													height: (windowSize.height * 2),
													width: (windowSize.width * 2),
													top: (statusSize.height * 2)
												};
												// Take the screenshot
												driver
													.sleep(2000)
													.takeScreenshot()
													.then(screenshot => processImg(`${ticket}_${platform}_${number}`, screenshot, directory, thresh, dimensions))
													.then(() => resolve())
													.catch(err => reject(err));
											});
									});
								break;

							case 'Android':
								driver
									.sleep(1000)
									.elementsById('android:id/statusBarBackground')
									.then(elements => {
										if(elements.length > 0) {
											// Get the size of the window frame
											driver
												.elementByXPath('//android.widget.FrameLayout[@instance="0"]')
												.getSize()
												.then(frameSize => {
													// Get the size of the navigation bar
													driver
														.elementById('android:id/navigationBarBackground')
														.getSize()
														.then(navSize => {
															// Get the size of the status bar
															driver
																.elementById('android:id/statusBarBackground')
																.getSize()
																.then(statusSize => {
																	// Create the full window height
																	const
																		windowWidth = (frameSize.width),
																		windowHeight = (frameSize.height - (navSize.height * 1.5));

																	// Create the config for PNGCrop to use
																	let dimensions = {
																		height: (windowHeight),
																		width: (windowWidth),
																		top: (statusSize.height)
																	};

																	// Take the screenshot
																	driver
																		.sleep(1000)
																		.takeScreenshot()
																		.then(screenshot => processImg(`${ticket}_${platform}_${number}`, screenshot, directory, thresh, dimensions))
																		.then(() => resolve())
																		.catch(err => reject(err));
																});
														});
												});
										} else {
											// Take the screenshot
											driver
												.sleep(1000)
												.takeScreenshot()
												.then(screenshot => processImg(`${ticket}_${platform}_${number}`, screenshot, directory, thresh))
												.then(() => resolve())
												.catch(err => reject(err));
										}
									});
							}
						});
				});
			});

			output.finish(resolve);
		});
	}
	/*****************************************************************************
	 * Custom filters used for the tests, to ensure tests run against the correct
	 * platform.
	 ****************************************************************************/
	static addFilters() {
		return new Promise(resolve => {
			output.info('Loading Custom WebDriver Filters... ');

			global.filters = {
				mac: () => {
					return process.platform === 'darwin';
				},
				windows: () => {
					return process.platform === 'win32';
				}
			};

			output.finish(resolve);
		});
	}
}

module.exports = WebDriver_Helper;

function processImg(ticket, screenshot, directory, thresh, dimensions) {
	return new Promise((resolve, reject) => {
		const
			testPath = path.join(global.projRoot, 'Logs', global.timestamp.format('DD-MM-YYYY_HH꞉mm꞉ss'), 'Screen_Shots'),
			refPath = path.join(directory, '..', 'Screen_Shots'),
			testImg = path.join(testPath, `${ticket}_Failure.png`),
			reference = path.join(refPath, `${ticket}.png`);

		let imgPath;

		// If the gather flag has been supplied, overwrite the existing screenshot
		if(global.screenshot) {
			imgPath = reference;
		} else {
			imgPath = testImg;
		}

		writeImg(screenshot, imgPath)
			.then(() => cropImg(imgPath, dimensions))
			.then(() => compImg(testImg, reference, thresh))
			.then(() => resolve())
			.catch(err => reject(err));
	});
}

function writeImg(screenshot, path) {
	return new Promise((resolve, reject) => {
		fs.writeFile(path, screenshot, 'base64', (writeErr) => {
			if(writeErr) {
				reject(writeErr);
			} else {
				resolve();
			}
		});
	});
}

function cropImg(imgPath, dimensions) {
	return new Promise((resolve, reject) => {

		if(!dimensions) {
			resolve();
		}

		PNGCrop.crop(imgPath, imgPath, dimensions, (cropErr) => {
			if(cropErr) {
				reject(cropErr);
			} else {
				resolve(imgPath);
			}
		});
	});
}

/*******************************************************************************
 * Take the screenshot from the mocha test, write it to a file, and compare it
 * to the reference screenshot. If it does not meet a similarity threshold
 * then fail the test. If it does, remove the file and pass the test.
 *
 * @param {String} ticket - The ticket of the test being run
 * @param {String} test - The directory of the test files
 * @param {String} screenshot - A Base64 string of the screenshot data
 * @param {Decimal} thresh - A custom defined image matching threshold
 * @param {Object} dimensions - The cropping dimension based on the window size
 ******************************************************************************/
function compImg(testImg, reference, thresh) {
	return new Promise((resolve, reject) => {

		if(global.screenshot) {
			return resolve();
		}

		let threshold = 0.10;

		// If a custom threshold was defined, use that instead
		if(thresh) {
			threshold = thresh;
		}

		resemble(testImg).compareTo(reference).onComplete((difference) => {
			if(difference.misMatchPercentage <= threshold) {
				fs.unlinkSync(testImg);
				resolve();
			} else {
				reject(new Error(`Images didn't meet required threshold, wanted below: ${threshold}%, got: ${difference.misMatchPercentage}%`));
			}
		});
	});
}