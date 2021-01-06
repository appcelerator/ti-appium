'use strict';

const
	path = require('path'),
	fs = require('fs-extra'),
	pngcrop = require('png-crop'),
	output = require('./output.js'),
	resemble = require('node-resemble-js');

/**
 * @namespace WebDriverCommands
 * @desc
 * Custom defined commands that can be used for testing. Provides a number of
 * helper commands such as element finding, touch actions and screenshot testing.
 */

/**
 * @class Webdriver_Helper
 * @desc
 * Loads in all the extra webdriver commands that can be used in tests.
 * Mainly utility helpers such as element finders and touch actions, but
 * also includes screenshot comparison methods.
 */
class WebDriver_Helper {
	/**
	 * @function loadDriverCommands
	 * @desc
	 * Generate commands that can be used by the driver. Used for creating
	 * shortcuts we can use in testing to avoid massive code repetition.
	 * @memberof Webdriver_Helper
	 *
	 * @param {Object} driver - The driver object to execute commands
	 * @param {Object} webdriver - The webdriver to add the commands to
	 */
	static loadDriverCommands(driver, webdriver) {
		output.debug('Loading in custom WebDriver commands');

		/**
		 * @function getPlatform
		 * @desc
		 * Return the OS of the current device, using the session.
		 * @memberof WebDriverCommands
		 */
		webdriver.addPromiseMethod('getPlatform', () => {
			return driver
				.sessionCapabilities()
				.then(capabilities => {
					return capabilities.platformName;
				});
		});

		/**
		 * @function androidHideKeyboard
		 * @desc
		 * Used for hiding the keyboard on Android devices, as it
		 * sometimes focuses on new text fields.
		 * @memberof WebDriverCommands
		 */
		webdriver.addPromiseMethod('androidHideKeyboard', () => {
			return driver
				.getPlatform()
				.then(platform => {
					if (platform === 'Android') {
						return driver.hideKeyboard();
					} else {
						return true;
					}
				});
		});

		/**
		 * @function getText
		 * @desc
		 * Get the text from the passed UI elements.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('getText', function () {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return this.getAttribute('value');

						case 'Android':
							return this.getAttribute('text');
					}
				});
		});

		/**
		 * @function alertAccept
		 * @desc
		 * Accept the alert on the display to clear it away.
		 * @memberof WebDriverCommands
		 */
		webdriver.addPromiseMethod('alertAccept', () => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver
								.elementText('OK')
								.click()
								.sleep(500);

						case 'Android':
							return driver
								.elementsText('OK', { preserve: true })
								.then(elements => {
									if (elements.length === 0) {
										return driver
											.back()
											.sleep(500);
									} else {
										return driver
											.elementText('OK', { preserve: true })
											.click()
											.sleep(500);
									}
								});
					}
				});
		});

		/**
		 * @function enter
		 * @desc
		 * Equivelant to hitting the return key, do so for the required platform.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} term - The enter term to be clicked on iOS devices.
		 */
		webdriver.addPromiseMethod('enter', term => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver
								.elementText(term)
								.click();

						case 'Android':
							return driver.pressKeycode(66); // Enter key
					}
				});
		});

		/**
		 * @function backspace
		 * @desc
		 * Use the backspace key on the keyboard for the required platform.
		 * @memberof WebDriverCommands
		 */
		webdriver.addPromiseMethod('backspace', () => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver
								.elementByXPath('//XCUIElementTypeKey[@name="delete"]')
								.click();

						case 'Android':
							return driver.pressKeycode(67); // Backspace key
					}
				});
		});

		/**
		 * @function elementClassName
		 * @desc
		 * Return an element by its platform specific class name.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} className - The class name of the desired element.
		 */
		webdriver.addPromiseMethod('elementClassName', (className) => {
			return driver.waitForElementByClassName(className, webdriver.asserters.isDisplayed, 1000);
		});

		/**
		 * @function elementsClassName
		 * @desc
		 * Count the number of elements by its platform specific class name.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} className - The class name of the desired element.
		 */
		webdriver.addPromiseMethod('elementsClassName', (className) => {
			return driver.elementsByClassName(className);
		});

		/**
		 * @function waitForElementClassName
		 * @desc
		 * Return an element by its platform specific class name, but allow wait.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} className - The class name of the desired element.
		 * @param {Int} time - How long to wait in milliseconds.
		 */
		webdriver.addPromiseMethod('waitForElementClassName', (className, time = 3000) => {
			return driver.waitForElementByClassName(className, webdriver.asserters.isDisplayed, time);
		});

		/**
		 * @function elementXPath
		 * @desc
		 * Return an element by its XPath.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} xPath - The XPath selector of the desired element.
		 */
		webdriver.addPromiseMethod('elementXPath', (xPath) => {
			return driver.waitForElementByXPath(xPath, webdriver.asserters.isDisplayed, 1000);
		});

		/**
		 * @function elementsXPath
		 * @desc
		 * Count the number of elements by its XPath.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} xPath - The XPath selector of the desired element.
		 */
		webdriver.addPromiseMethod('elementsXPath', (xPath) => {
			return driver.elementsByXPath(xPath);
		});

		/**
		 * @function waitForElementXPath
		 * @desc
		 * Return an element by its XPath, but allow wait.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} xPath - The XPath selector of the desired element.
		 * @param {Int} time - How long to wait in milliseconds.
		 */
		webdriver.addPromiseMethod('waitForElementXPath', (xPath, time = 3000) => {
			return driver.waitForElementByXPath(xPath, webdriver.asserters.isDisplayed, time);
		});

		/**
		 * @function elementId
		 * @desc
		 * Return an element by its ID.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} element - The element ID used to identify the element.
		 */
		webdriver.addPromiseMethod('elementId', (element) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.waitForElementById(element, webdriver.asserters.isDisplayed, 1000);

						case 'Android':
							return driver.waitForElementByAccessibilityId(element, webdriver.asserters.isDisplayed, 1000);
					}
				});
		});

		/**
		 * @function elementsId
		 * @desc
		 * Count the number of elements by its ID.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} element - The element ID used to identify the element.
		 */
		webdriver.addPromiseMethod('elementsId', (element) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.elementsById(element);

						case 'Android':
							return driver.elementsByAccessibilityId(element);
					}
				});
		});

		/**
		 * @function waitForElementId
		 * @desc
		 * Return an element by its ID, but allow wait.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} element - The element ID used to identify the element.
		 * @param {Int} time - How long to wait in milliseconds.
		 */
		webdriver.addPromiseMethod('waitForElementId', (element, time = 3000) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.waitForElementById(element, webdriver.asserters.isDisplayed, time);

						case 'Android':
							return driver.waitForElementByAccessibilityId(element, webdriver.asserters.isDisplayed, time);
					}
				});
		});

		/**
		 * @function elementText
		 * @desc
		 * Return an element by its text content.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} text - The text to identify the element
		 */
		webdriver.addPromiseMethod('elementText', async (text, { caseSensitive = false } = {}) => {
			switch (await driver.getPlatform()) {
				case 'iOS':
					return driver.waitForElementById(text, webdriver.asserters.isDisplayed, 1000);

				case 'Android':
					if (caseSensitive) {
						return driver.waitForElementByAndroidUIAutomator(`new UiSelector().text("${text}")`, webdriver.asserters.isDisplayed, 1000);
					} else {
						const
							upperCase = text.toUpperCase(text),
							lowerCase = text.toLowerCase(text);

						return driver.waitForElementByXPath(`//*[@text="${text}" or @text="${upperCase}" or @text="${lowerCase}"]`, webdriver.asserters.isDisplayed, 1000);
					}
			}
		});

		/**
		 * @function elementsText
		 * @desc
		 * Count the number of elements by its text content.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} text - The text to identify the element
		 */
		webdriver.addPromiseMethod('elementsText', async (text, { caseSensitive = false } = {}) => {
			switch (await driver.getPlatform()) {
				case 'iOS':
					return driver.elementsById(text);

				case 'Android':
					if (caseSensitive) {
						return driver.elementsByAndroidUIAutomator(`new UiSelector().text("${text}")`);
					} else {
						const
							upperCase = text.toUpperCase(text),
							lowerCase = text.toLowerCase(text);

						return driver.elementsByXPath(`//*[@text="${text}" or @text="${upperCase}" or @text="${lowerCase}"]`);
					}
			}
		});

		/**
		 * @function waitForElementText
		 * @desc
		 * Return an element by its text content, but allow wait.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} text - The text to identify the element
		 * @param {Int} time - How long to wait in milliseconds
		 */
		webdriver.addPromiseMethod('waitForElementText', async (text, { time = 3000, caseSensitive = false } = {}) => {
			switch (await driver.getPlatform()) {
				case 'iOS':
					return driver.waitForElementById(text, webdriver.asserters.isDisplayed, time);

				case 'Android':
					if (caseSensitive) {
						return driver.waitForElementByAndroidUIAutomator(`new UiSelector().text("${text}")`, webdriver.asserters.isDisplayed, time);
					} else {
						const
							upperCase = text.toUpperCase(text),
							lowerCase = text.toLowerCase(text);

						return driver.waitForElementByXPath(`//*[@text="${text}" or @text="${upperCase}" or @text="${lowerCase}"]`, webdriver.asserters.isDisplayed, time);
					}
			}
		});

		/**
		 * @function getBounds
		 * @desc
		 * Get the dimensions, and coordinates of an element, then return them.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('getBounds', function () {
			return this
				.getSize()
				.then(size => {
					return this
						.getLocation()
						.then(loc => {
							const bounds = {
								x: loc.x,
								y: loc.y,
								width: size.width,
								height: size.height
							};

							return bounds;
						});
				});
		});

		/**
		 * @function longpress
		 * @desc
		 * Longpress on the passed element.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('longpress', function () {
			return this
				.getBounds()
				.then(bounds => {
					const action = new webdriver.TouchAction()
						.press({
							x: (bounds.x + (bounds.width / 2)).toFixed(0),
							y: (bounds.y + (bounds.height / 2)).toFixed(0)
						})
						.wait(3000)
						.release();

					return driver.performTouchAction(action);
				});
		});

		/**
		 * @function doubleClick
		 * @desc
		 * Double click on the passed element.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('doubleClick', function () {
			return this
				.getBounds()
				.then(bounds => {
					const action = new webdriver.TouchAction()
						.press({
							x: (bounds.x + (bounds.width / 2)).toFixed(0),
							y: (bounds.y + (bounds.height / 2)).toFixed(0)
						})
						.release();

					return driver
						.performTouchAction(action)
						.performTouchAction(action);
				});
		});

		/**
		 * @function scrollUp
		 * @desc
		 * Scroll up on the entire height of the passed element.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('scrollUp', async function () {
			const
				platform = await driver.getPlatform(),
				bounds = await this.getBounds();

			switch (platform) {
				case 'iOS':
					await driver.execute('mobile: scroll', { direction: 'up', element: this });
					break;

				case 'Android':
					await driver.performTouchAction(
						new webdriver.TouchAction()
							.press({
								x: (bounds.x + (bounds.width / 2)).toFixed(0),
								y: (bounds.y + 1).toFixed(0)
							})
							.moveTo({
								x: (bounds.x + (bounds.width / 2)).toFixed(0),
								y: (bounds.y + (bounds.height - 1)).toFixed(0)
							})
							.release());
					break;
			}
		});

		/**
		 * @function scrollDown
		 * @desc
		 * Scroll down on the entire height of the passed element.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('scrollDown', async function () {
			const
				platform = await driver.getPlatform(),
				bounds = await this.getBounds();

			switch (platform) {
				case 'iOS':
					await driver.execute('mobile: scroll', { direction: 'down', element: this });
					break;

				case 'Android':
					await driver.performTouchAction(
						new webdriver.TouchAction()
							.press({
								x: (bounds.x + (bounds.width / 2)).toFixed(0),
								y: (bounds.y + (bounds.height - 1)).toFixed(0)
							})
							.moveTo({
								x: (bounds.x + (bounds.width / 2)).toFixed(0),
								y: (bounds.y + 1).toFixed(0)
							})
							.release());
					break;
			}
		});

		/**
		 * @function swipeRight
		 * @desc
		 * Swipe right across the entire width of the passed element.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('swipeRight', async function () {
			const
				platform = await driver.getPlatform(),
				bounds = await this.getBounds();

			switch (platform) {
				case 'iOS':
					await driver.execute('mobile: swipe', { direction: 'right', element: this });
					break;

				case 'Android':
					await driver.performTouchAction(
						new webdriver.TouchAction()
							.press({
								x: (bounds.x + 1).toFixed(0),
								y: (bounds.y + (bounds.height / 2)).toFixed(0)
							})
							.moveTo({
								x: (bounds.x + (bounds.width - 1)).toFixed(0),
								y: (bounds.y + (bounds.height / 2)).toFixed(0)
							})
							.release());
					break;
			}
		});

		/**
		 * @function swipeLeft
		 * @desc
		 * Swipe left across the entire width of the passed element.
		 * @memberof WebDriverCommands
		 */
		webdriver.addElementPromiseMethod('swipeLeft', async function () {
			const
				platform = await driver.getPlatform(),
				bounds = await this.getBounds();

			switch (platform) {
				case 'iOS':
					await driver.execute('mobile: swipe', { direction: 'left', element: this });
					break;

				case 'Android':
					await driver.performTouchAction(
						new webdriver.TouchAction()
							.press({
								x: (bounds.x + (bounds.width - 1)).toFixed(0),
								y: (bounds.y + (bounds.height / 2)).toFixed(0)
							})
							.moveTo({
								x: (bounds.x + 1).toFixed(0),
								y: (bounds.y + (bounds.height / 2)).toFixed(0)
							})
							.release());
					break;
			}
		});

		/**
		 * @function getLog
		 * @desc
		 * Return the latest log capture from Appium.
		 * @memberof WebDriverCommands
		 */
		webdriver.addPromiseMethod('getLog', () => {
			return driver
				.getPlatform()
				.then(platform => {
					let logType;

					if (platform === 'iOS') {
						logType = 'syslog';
					}
					if (platform === 'Android') {
						logType = 'logcat';
					}

					return driver
						.sleep(500)
						.log(logType)
						.then(log => {
							let messages = [];

							// Capture only the messages from the log
							log.forEach(item => messages.push(item.message));

							return messages;
						});
				});
		});

		/**
		 * @function logShouldContain
		 * @desc
		 * Check that a message appears in the device log.
		 * @memberof WebDriverCommands
		 *
		 * @param {String[]} log - The Log to be searched through
		 * @param {String[]} searchStrings - Strings that should be present in the log
		 */
		webdriver.addPromiseMethod('logShouldContain', (log, searchStrings) => {
			searchStrings.forEach(searchString => {
				const
					formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
					expression = new RegExp(formatted);

				log.should.include.match(expression);
			});
		});

		/**
		 * @function logShouldNotContain
		 * @desc
		 * Check that a message doesn't appear in the device log.
		 * @memberof WebDriverCommands
		 *
		 * @param {String[]} log - The Log to be searched through
		 * @param {String[]} searchStrings - Strings that shouldn't be present in the log
		 */
		webdriver.addPromiseMethod('logShouldNotContain', (log, searchStrings) => {
			searchStrings.forEach(searchString => {
				const
					formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
					expression = new RegExp(formatted);

				log.should.not.include.match(expression);
			});
		});

		/**
		 * @function logCount
		 * @desc
		 * Count the amount of times a message appears in a log.
		 * @memberof WebDriverCommands
		 *
		 * @param {String[]} log - The Log to be searched through
		 * @param {String} searchString - String that should be present in the log
		 * @param {Int} iterations - The amount of times the string should be present
		 */
		webdriver.addPromiseMethod('logCount', (log, searchString, iterations) => {
			const messages = [];

			// Capture only the messages from the log
			log.forEach(item => {
				const
					formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
					expression = new RegExp(formatted);

				if (item.match(expression)) {
					messages.push(item);
				}
			});

			messages.length.should.equal(iterations);
		});

		/**
		 * @function getDensity
		 * @desc
		 * Used for finding the screen density of Android devices
		 * @memberof WebDriverCommands
		 */
		webdriver.addPromiseMethod('getDensity', async () => {
			const session = await driver.sessionCapabilities();

			switch (session.platformName) {
				case 'Android':
					switch (session.deviceScreenDensity) {
						case 120:
							return 0.75;

						case 160:
							return 1;

						case 240:
							return 1.5;

						case 320:
							return 2;

						case 480:
							return 3;

						default:
							return 1;
					}

				default:
					return 1;
			}
		});

		/**
		 * @function getDensity
		 * @desc
		 * Used for finding the screen density of Android devices
		 * @memberof WebDriverCommands
		 */
		webdriver.addPromiseMethod('getDensity', async () => {
			const session = await driver.sessionCapabilities();

			switch (session.platformName) {
				case 'Android':
					switch (session.deviceScreenDensity) {
						case 120:
							return 0.75;

						case 160:
							return 1;

						case 240:
							return 1.5;

						case 320:
							return 2;

						case 480:
							return 3;

						default:
							return 1;
					}

				default:
					return 1;
			}
		});

		/**
		 * @function screenshotTest
		 * @desc
		 * Take a screenshot on the device, and then compare it to a reference
		 * screenshot and validate the result against a configurable threshold.
		 * @memberof WebDriverCommands
		 *
		 * @param {String} file - The path to the reference image
		 * @param {String} modRoot - The path to the root of the project being tested
		 * @param {Object} opts - Optional arguments
		 * @param {Float} opts.thresh - Percentage fault value for image matching likeness
		 * @param {Boolean} opts.overwrite - Whether or not to overwrite the reference image
		 * @param {Int} opts.delay - The time to wait before taking the screenshot in milliseconds
		 */
		webdriver.addPromiseMethod('screenshotTest', async (file, modRoot, { thresh = 0.20, overwrite = false, delay = 2000 } = {}) => {
			// return new Promise((resolve, reject) => {
			await driver.sleep(delay);

			const platform = await driver.getPlatform();

			switch (platform) {
				case 'iOS':
				// Get the size of the window frame
					const winVal = await driver
						.elementByClassName('XCUIElementTypeWindow')
						.getBounds();

					// Create the config for PNGCrop to use
					const dimensions = {
						height: (winVal.height * 2),
						width: (winVal.width * 2),
						top: 40
					};

					try {
					// Take the screenshot
						const screenshot = await driver.takeScreenshot();
						return processImg(file, modRoot, screenshot, thresh, overwrite, dimensions);
					} catch (e) {
						throw e;
					}

				case 'Android':

					const capabilities = await driver.sessionCapabilities();
					const decorName = `${capabilities.appPackage}:id/decor_content_parent`;

					const elements = await driver.elementsById(decorName);

					if (elements.length > 0) {
						// Get the size of the window frame
						const bounds = await driver
							.elementById(decorName)
							.getBounds();

						// Create the config for PNGCrop to use
						const dimensions = {
							height: (bounds.height),
							width: (bounds.width),
							top: (bounds.y)
						};

						try {
							// Take the screenshot
							const screenshot = await driver.takeScreenshot();
							return processImg(file, modRoot, screenshot, thresh, overwrite, dimensions);
						} catch (e) {
							throw e;
						}
					} else {
						try {
							// Take the screenshot
							const screenshot = await driver.takeScreenshot();
							return processImg(file, modRoot, screenshot, thresh, overwrite);
						} catch (e) {
							throw e;
						}
					}
			}
		});

		/**
		 * @function fullScreenshotTest
		 * @desc
		 * Compares a screenshot of the app in its current state, to a stored
		 * reference image to see how they match. (Leaves the status bar in, for
		 * tests which may require it).
		 * @memberof WebDriverCommands
		 *
		 * @param {String} file - The path to the reference image
		 * @param {String} modRoot - The path to the root of the project being tested
		 * @param {Object} opts - Arguments
		 * @param {Float} opts.thresh - Percentage fault value for image matching likeness
		 * @param {Boolean} opts.overwrite - Whether or not to overwrite the reference image
		 * @param {Int} opts.delay - The time to wait before taking the screenshot in milliseconds
		 */
		webdriver.addPromiseMethod('fullScreenshotTest', async (file, modRoot, { thresh = 0.20, overwrite = false, delay = 2000 } = {}) => {
			await driver.sleep(delay);

			const screenshot = await driver.takeScreenshot();

			return processImg(file, modRoot, screenshot, thresh, overwrite);
		});
	}
}

module.exports = WebDriver_Helper;

/**
 * Take the base64 encoded string of the screenshot, and compare it to the
 * stored reference image, then return the result.
 * @private
 *
 * @param {String} file - The path to the reference image
 * @param {String} modRoot - The path to the root of the project being tested
 * @param {String} screenshot - The base64 encoded string representing the image
 * @param {Decimal} thresh - A custom defined image matching threshold
 * @param {Boolean} overwrite - Flag triggers overwrite of reference screenshot
 * @param {Object} dimensions - The dimensions to crop the image down to
 */
async function processImg(file, modRoot, screenshot, thresh, overwrite, dimensions) {
	let
		screenshotDir = path.join(modRoot, 'Screen_Shots'),
		screenshotPath = path.join(screenshotDir, path.basename(file));

	fs.ensureDirSync(screenshotDir);

	if (overwrite) {
		output.debug(`Overwite found, writing image to ${file}`);
		try {
			fs.writeFileSync(file, screenshot, 'base64');
			await cropImg(file, dimensions);
			return;
		} catch (e) {
			throw e;
		}
	} else {
		if (!fs.existsSync(file)) { throw new Error(`Reference screenshot "${path.basename(file)}" doesn't exist`); }

		const elem = path.parse(screenshotPath);

		screenshotPath = path.format({
			name: `${elem.name}_Test`,
			root: elem.root,
			dir: elem.dir,
			ext: elem.ext
		});

		output.debug(`Comparing ${screenshotPath} to ${file}`);
		try {
			fs.writeFileSync(screenshotPath, screenshot, 'base64');
			await cropImg(screenshotPath, dimensions);
			await compImg(screenshotPath, file, thresh);
		} catch (e) {
			throw e;
		}
	}
}

/**
 * Crop the image down to size dependant on the passed dimensions.
 * @private
 *
 * @param {String} imgPath - The path to the screenshot to be cropped
 * @param {Object} dimensions - The dimensions to crop the image down to
 */
function cropImg(imgPath, dimensions) {
	return new Promise((resolve, reject) => {

		if (!dimensions) {
			resolve();
		}

		pngcrop.crop(imgPath, imgPath, dimensions, (cropErr) => {
			if (cropErr) {
				reject(cropErr);
			} else {
				resolve(imgPath);
			}
		});
	});
}

/**
 * Compare the taken screenshot, to a reference screenshot stored in the test
 * repo. Allows for the custom definition of a comparison threshold for
 * allowing leniancy in the comparison.
 * @private
 *
 * @param {String} testImg - The path to the screenshot to be tested
 * @param {String} reference - The path to the base reference screenshot
 * @param {Decimal} thresh - A custom defined image matching threshold
 */
function compImg(testImg, reference, thresh) {
	return new Promise((resolve, reject) => {
		let threshold = 0.10;

		// If a custom threshold was defined, use that instead
		if (thresh) {
			threshold = thresh;
		}

		resemble(testImg).compareTo(reference).onComplete((difference) => {
			if (difference.misMatchPercentage <= threshold) {
				fs.unlinkSync(testImg);
				resolve();
			} else {
				reject(new Error(`Images didn't meet required threshold, wanted below: ${threshold}%, got: ${difference.misMatchPercentage}%`));
			}
		});
	});
}
