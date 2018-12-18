'use strict';

const
	path = require('path'),
	fs = require('fs-extra'),
	PNGCrop = require('png-crop'),
	output = require('./output.js'),
	resemble = require('node-resemble-js');

class WebDriver_Helper {
	/*****************************************************************************
	 * Generate commands that can be used by the driver. Used for creating
	 * shortcuts we can use in testing to avoid massive code repetition
	 ****************************************************************************/
	static loadDriverCommands(driver, webdriver) {
		return new Promise(resolve => {
			output.debug('Loading in custom WebDriver commands');

			/*****************************************************************************
			 * Take a screenshot on the device, and then compare it to a reference
			 * screenshot and validate the result against a configurable threshold
			 ****************************************************************************/
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

			resolve();
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

/*******************************************************************************
 * Take the base64 encoded string of the screenshot, and compare it to the
 * stored reference image, then return the result.
 *
 * @param {String} name - The name of the image, and its reference
 * @param {String} screenshot - The base64 encoded string representing the image
 * @param {String} directory - The location of the test calling this function
 * @param {Decimal} thresh - A custom defined image matching threshold
 * @param {Object} dimensions - The dimensions to crop the image down to
 ******************************************************************************/
function processImg(name, screenshot, directory, thresh, dimensions) {
	return new Promise((resolve, reject) => {
		const
			testPath = path.join(global.projRoot, 'Logs', global.timestamp.format('DD-MM-YYYY_HH꞉mm꞉ss'), 'Screen_Shots'),
			refPath = path.join(directory, '..', 'Screen_Shots'),
			testImg = path.join(testPath, `${name}_Failure.png`),
			reference = path.join(refPath, `${name}.png`);

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

/*******************************************************************************
 * Take the base64 encoding of the image, and write it into a file.
 *
 * @param {String} screenshot - The base64 encoded string representing the image
 * @param {String} path - A path to where the image file should be written
 ******************************************************************************/
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

/*******************************************************************************
 * Crop the image down to size dependant on the passed dimensions.
 *
 * @param {String} imgPath - The path to the screenshot to be cropped
 * @param {Object} dimensions - The dimensions to crop the image down to
 ******************************************************************************/
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
 * Compare the taken screenshot, to a reference screenshot stored in the test
 * repo. Allows for the custom definition of a comparison threshold for
 * allowing leniancy in the comparison.
 *
 * @param {String} testImg - The path to the screenshot to be tested
 * @param {String} reference - The path to the base reference screenshot
 * @param {Decimal} thresh - A custom defined image matching threshold
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