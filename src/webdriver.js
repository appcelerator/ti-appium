'use strict';

const
	path = require('path'),
	fs = require('fs-extra'),
	pngcrop = require('png-crop'),
	output = require('./output.js'),
	resemble = require('node-resemble-js');

class WebDriver_Helper {
	/*****************************************************************************
	 * Generate commands that can be used by the driver. Used for creating
	 * shortcuts we can use in testing to avoid massive code repetition
	 ****************************************************************************/
	static loadDriverCommands(driver, webdriver) {
		output.debug('Loading in custom WebDriver commands');

		/*************************************************************************
		 * Return the OS of the current device, using the session.
		 ************************************************************************/
		webdriver.addPromiseMethod('getPlatform', () => {
			return driver
				.sessionCapabilities()
				.then(capabilities => {
					return capabilities.platformName;
				});
		});

		/*************************************************************************
		 * Used for hiding the keyboard on Android devices, as it sometimes
		 * focuses on new text fields.
		 ************************************************************************/
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

		/*************************************************************************
		 * Get the text from the passed UI elements.
		 ************************************************************************/
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

		/*************************************************************************
		 * Accept the alert on the display to clear it away.
		 ************************************************************************/
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
								.elementsText('OK')
								.then(elements => {
									if (elements.length === 0) {
										return driver
											.back()
											.sleep(500);
									} else {
										return driver
											.elementText('OK')
											.click()
											.sleep(500);
									}
								});
					}
				});
		});

		/*************************************************************************
		 * Equivelant to hitting the return key, do so for the required platform.
		 ************************************************************************/
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

		/*************************************************************************
		 * Use the backspace key on the keyboard for the required platform.
		 ************************************************************************/
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

		/*************************************************************************
		 * Return an element, by its platform specific class name.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementClassName', elementType => {
			return driver
				.getPlatform()
				.then(platform => {
					return driver.elementByClassName(getElement(elementType, platform));
				});
		});

		/*************************************************************************
		 * Count the number of elements, by its platform specific class name.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementsClassName', elementType => {
			return driver
				.getPlatform()
				.then(platform => {
					return driver.elementsByClassName(getElement(elementType, platform));
				});
		});

		/*************************************************************************
		 * Return an element, by its platform specific class name, but allow wait.
		 ************************************************************************/
		webdriver.addPromiseMethod('waitForElementClassName', (elementType, time) => {
			return driver
				.getPlatform()
				.then(platform => {
					return driver.waitForElementByClassName(getElement(elementType, platform), webdriver.asserters.isDisplayed, time);
				});
		});

		/*************************************************************************
		 * Return an element, by its platform specific XPath.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementXPath', (elementType, id, position) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.elementByXPath(`(//${getElement(elementType, platform)}[@name="${id}"])[${position}]`);

						case 'Android':
							return driver.elementByXPath(`(//${getElement(elementType, platform)}[@content-desc="${id}."])[${position}]`);
					}
				});
		});

		/*************************************************************************
		 * Count the number of elements, by its platform specific XPath.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementsXPath', (elementType, id, position) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.elementsByXPath(`(//${getElement(elementType, platform)}[@name="${id}"])[${position}]`);

						case 'Android':
							return driver.elementsByXPath(`(//${getElement(elementType, platform)}[@content-desc="${id}."])[${position}]`);
					}
				});
		});

		/*************************************************************************
		 * Return an element, by its platform specific XPath, but allow wait.
		 ************************************************************************/
		webdriver.addPromiseMethod('waitForElementXPath', (elementType, id, position, time) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.waitForElementByXPath(`(//${getElement(elementType, platform)}[@name="${id}"])[${position}]`, webdriver.asserters.isDisplayed, time);

						case 'Android':
							return driver.waitForElementByXPath(`(//${getElement(elementType, platform)}[@content-desc="${id}."])[${position}]`, webdriver.asserters.isDisplayed, time);
					}
				});
		});

		/*************************************************************************
		 * Return an element, by its ID.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementId', (element) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.elementById(element);

						case 'Android':
							return driver.elementById(`${element}.`);
					}
				});
		});

		/*************************************************************************
		 * Count the number of elements, by its ID.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementsId', (element) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.elementsById(element);

						case 'Android':
							return driver.elementsById(`${element}.`);
					}
				});
		});

		/*************************************************************************
		 * Return an element, by its ID, but allow wait.
		 ************************************************************************/
		webdriver.addPromiseMethod('waitForElementId', (elementType, time) => {
			return driver
				.getPlatform()
				.then(platform => {
					switch (platform) {
						case 'iOS':
							return driver.waitForElementById(elementType, webdriver.asserters.isDisplayed, time);

						case 'Android':
							return driver.waitForElementById(`${elementType}.`, webdriver.asserters.isDisplayed, time);
					}
				});
		});

		/*************************************************************************
		 * Return an element, by its text content.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementText', (text, { preserve = false } = {}) => {
			return driver
				.sessions()
				.then(sessions => {
					switch (sessions[0].capabilities.platformName) {
						case 'iOS':
							return driver.elementById(text);

						case 'Android':
							function titleCase(str) {
								return str.replace(
									/\w\S*/g,
									function (txt) {
										return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
									}
								);
							}

							// Get the Android platform version from the Appium session
							let version = parseFloat(sessions[0].capabilities.platformVersion).toFixed(2);

							// Alter the string depending on the Android version
							if (version >= 7.0) {
								if (!preserve) {
									text = text.toUpperCase();
								}
							} else if (!preserve) {
								text = titleCase(text);
							}

							return driver.elementByAndroidUIAutomator(`new UiSelector().text("${text}")`);
					}
				});
		});

		/*************************************************************************
		 * Count the number of elements, by its text content.
		 ************************************************************************/
		webdriver.addPromiseMethod('elementsText', (text, { preserve = false } = {}) => {
			return driver
				.sessions()
				.then(sessions => {
					switch (sessions[0].capabilities.platformName) {
						case 'iOS':
							return driver.elementsById(text);

						case 'Android':
							function titleCase(str) {
								return str.replace(
									/\w\S*/g,
									function (txt) {
										return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
									}
								);
							}

							// Get the Android platform version from the Appium session
							let version = parseFloat(sessions[0].capabilities.platformVersion).toFixed(2);

							// Alter the string depending on the Android version
							if (version >= 7.0) {
								if (!preserve) {
									text = text.toUpperCase();
								}
							} else if (!preserve) {
								text = titleCase(text);
							}

							return driver.elementsByAndroidUIAutomator(`new UiSelector().text("${text}")`);
					}
				});
		});

		/*************************************************************************
		 * Return an element, by its text content, but allow wait.
		 ************************************************************************/
		webdriver.addPromiseMethod('waitForElementText', (text, { preserve = false, time = 1000 } = {}) => {
			return driver
				.sessions()
				.then(sessions => {
					switch (sessions[0].capabilities.platformName) {
						case 'iOS':
							return driver.waitForElementById(text, webdriver.asserters.isDisplayed, time);

						case 'Android':
							function titleCase(str) {
								return str.replace(
									/\w\S*/g,
									function (txt) {
										return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
									}
								);
							}

							// Get the Android platform version from the Appium session
							let version = parseFloat(sessions[0].capabilities.platformVersion).toFixed(2);

							// Alter the string depending on the Android version
							if (version >= 7.0) {
								if (!preserve) {
									text = text.toUpperCase();
								}
							} else if (!preserve) {
								text = titleCase(text);
							}

							return driver.waitForElementByAndroidUIAutomator(`new UiSelector().text("${text}")`, webdriver.asserters.isDisplayed, time);
					}
				});
		});

		/*************************************************************************
		 * Get the dimensions, and coordinates of an element, then return them.
		 ************************************************************************/
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

		/*************************************************************************
		 * Longpress on the passed element.
		 ************************************************************************/
		webdriver.addElementPromiseMethod('longpress', function () {
			return this
				.getSize()
				.then(size => {
					return this
						.getLocation()
						.then(loc => {
							const action = new webdriver.TouchAction()
								.press({
									x: (loc.x + (size.width / 2)),
									y: (loc.y + (size.height / 2))
								})
								.wait(3000)
								.release();

							return driver.performTouchAction(action);
						});
				});
		});

		/*************************************************************************
		 * Double click on the passed element.
		 ************************************************************************/
		webdriver.addElementPromiseMethod('doubleClick', function () {
			return this
				.getSize()
				.then(size => {
					return this
						.getLocation()
						.then(loc => {
							const action = new webdriver.TouchAction()
								.press({
									x: (loc.x + (size.width / 2)),
									y: (loc.y + (size.height / 2))
								})
								.release();

							return driver
								.performTouchAction(action)
								.performTouchAction(action);
						});
				});
		});

		/*************************************************************************
		 * Scroll up on the entire height of the passed element.
		 ************************************************************************/
		webdriver.addElementPromiseMethod('scrollUp', function () {
			return this
				.getSize()
				.then(size => {
					return this
						.getLocation()
						.then(loc => {
							return driver
								.getPlatform()
								.then(platform => {
									switch (platform) {
										case 'iOS':
											const iOSAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + (size.width / 2)),
													y: (loc.y + 20)
												})
												.moveTo({
													x: 0,
													y: (size.height * 1.5)
												})
												.release();

											return driver.performTouchAction(iOSAction);

										case 'Android':
											const AndroidAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + (size.width / 2)),
													y: (loc.y + 20)
												})
												.moveTo({
													x: 0,
													y: (size.height - 21)
												})
												.release();

											return driver.performTouchAction(AndroidAction);
									}
								});
						});
				});
		});

		/*************************************************************************
		 * Scroll down on the entire height of the passed element.
		 ************************************************************************/
		webdriver.addElementPromiseMethod('scrollDown', function () {
			return this
				.getSize()
				.then(size => {
					return this
						.getLocation()
						.then(loc => {
							return driver
								.getPlatform()
								.then(platform => {
									switch (platform) {
										case 'iOS':
											const iOSAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + (size.width / 2)),
													y: (loc.y + (size.height - 20))
												})
												.moveTo({
													x: 0,
													y: -(size.height * 1.5)
												})
												.release();

											return driver.performTouchAction(iOSAction);

										case 'Android':
											const AndroidAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + (size.width / 2)),
													y: (loc.y + (size.height - 20))
												})
												.moveTo({
													x: 0,
													y: -(size.height - 21)
												})
												.release();

											return driver.performTouchAction(AndroidAction);
									}
								});
						});
				});
		});

		/*************************************************************************
		 * Swipe right across the entire width of the passed element.
		 ************************************************************************/
		webdriver.addElementPromiseMethod('swipeRight', function () {
			return this
				.getSize()
				.then(size => {
					return this
						.getLocation()
						.then(loc => {
							return driver
								.getPlatform()
								.then(platform => {
									switch (platform) {
										case 'iOS':
											const iOSAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + (size.width - 20)),
													y: (loc.y + (size.height / 2))
												})
												.moveTo({
													x: -(size.width * 1.5),
													y: 0
												})
												.release();

											return driver.performTouchAction(iOSAction);

										case 'Android':
											const AndroidAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + (size.width - 20)),
													y: (loc.y + (size.height / 2))
												})
												.moveTo({
													x: -(size.width - 21),
													y: 0
												})
												.release();

											return driver.performTouchAction(AndroidAction);
									}
								});
						});
				});
		});

		/*************************************************************************
		 * Swipe left across the entire width of the passed element.
		 ************************************************************************/
		webdriver.addElementPromiseMethod('swipeLeft', function () {
			return this
				.getSize()
				.then(size => {
					return this
						.getLocation()
						.then(loc => {
							return driver
								.getPlatform()
								.then(platform => {
									switch (platform) {
										case 'iOS':
											const iOSAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + 20),
													y: (loc.y + (size.height / 2))
												})
												.moveTo({
													x: (size.width * 1.5),
													y: 0
												})
												.release();

											return driver.performTouchAction(iOSAction);

										case 'Android':
											const AndroidAction = new webdriver.TouchAction()
												.press({
													x: (loc.x + 20),
													y: (loc.y + (size.height / 2))
												})
												.moveTo({
													x: (size.width - 21),
													y: 0
												})
												.release();

											return driver.performTouchAction(AndroidAction);
									}
								});
						});
				});
		});

		/*************************************************************************
		 * Return the latest log capture from Appium
		 ************************************************************************/
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

		/*************************************************************************
		 * Check that a message appears in the device log.
		 ************************************************************************/
		webdriver.addPromiseMethod('logShouldContain', (log, searchStrings) => {
			searchStrings.forEach(searchString => {
				const
					formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
					expression = new RegExp(formatted);

				log.should.include.match(expression);
			});
		});

		/*************************************************************************
		 * Check that a message doesn't appear in the device log.
		 ************************************************************************/
		webdriver.addPromiseMethod('logShouldNotContain', (log, searchStrings) => {
			searchStrings.forEach(searchString => {
				const
					formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
					expression = new RegExp(formatted);

				log.should.not.include.match(expression);
			});
		});

		/*************************************************************************
		 * Count the amount of times a message appears in a log.
		 ************************************************************************/
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

		/*************************************************************************
		 * Check that a message appears in the device log. (DEPRECATED)
		 ************************************************************************/
		webdriver.addPromiseMethod('shouldLog', searchStrings => {
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
						.sleep(1000)
						.log(logType)
						.then(log => {
							let messages = [];

							// Capture only the messages from the log
							log.forEach(item => messages.push(item.message));

							searchStrings.forEach(searchString => {
								const
									formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
									expression = new RegExp(formatted);

								messages.should.include.match(expression);
							});
						});
				});
		});

		/*************************************************************************
		 * Check that a message doesn't appear in the device log. (DEPRECATED)
		 ************************************************************************/
		webdriver.addPromiseMethod('shouldNotLog', searchStrings => {
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

							searchStrings.forEach(searchString => {
								const
									formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
									expression = new RegExp(formatted);

								messages.should.not.include.match(expression);
							});
						});
				});
		});

		/*************************************************************************
		 * Count the amount of times a message appears in a log. (DEPRECATED)
		 ************************************************************************/
		webdriver.addPromiseMethod('countLog', (searchStrings, iterations) => {
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
							log.forEach(item => {
								searchStrings.forEach(searchString => {
									const
										formatted = searchString.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&'),
										expression = new RegExp(formatted);

									if (item.message.match(expression)) {
										messages.push(item.message);
									}
								});
							});

							messages.length.should.equal(iterations);
						});
				});
		});

		/*************************************************************************
		 * Used to find a ticket in the first page of an acceptance app.
		 ************************************************************************/
		webdriver.addPromiseMethod('searchForTicket', ticket => {
			ticket = ticket.replace('-', '');
			return driver
				.getPlatform()
				.then(platform => {
					if (platform === 'iOS') {
						return driver
							.waitForElementByClassName('XCUIElementTypeSearchField', webdriver.asserters.isDisplayed, 3000)
							.click()
							.sendKeys(ticket)
							.elementByXPath('(//XCUIElementTypeCell)[1]')
							.click();
					} else if (platform === 'Android') {
						return driver
							.elementByClassName('android.widget.EditText')
							.clear()
							.sendKeys(ticket)
							.elementByXPath(`(//android.widget.TextView[@text="${ticket}"])`)
							.click()
							.waitForElementByXPath(`(//android.widget.TextView[@text="${ticket}"])`, webdriver.asserters.isDisplayed, 10000);
					}
				});
		});

		/*************************************************************************
		 * Used to find a ticket in the first page of an acceptance app, but will
		 * expect an alert to be present as soon as the acceptance app loads.
		 ************************************************************************/
		webdriver.addPromiseMethod('searchForTicketWithAlert', ticket => {
			ticket = ticket.replace('-', '');
			return driver
				.getPlatform()
				.then(platform => {
					if (platform === 'iOS') {
						return driver
							.waitForElementByClassName('XCUIElementTypeSearchField', webdriver.asserters.isDisplayed, 3000)
							.click()
							.sendKeys(ticket)
							.elementByXPath('(//XCUIElementTypeCell)[1]')
							.click();
					} else if (platform === 'Android') {
						return driver
							.elementByClassName('android.widget.EditText')
							.clear()
							.sendKeys(ticket)
							.elementByXPath(`(//android.widget.TextView[@text="${ticket}"])`)
							.click()
							.waitForElementByAndroidUIAutomator('new UiSelector().text("Alert")', webdriver.asserters.isDisplayed, 10000);
					}
				});
		});

		/*****************************************************************************
		 * Take a screenshot on the device, and then compare it to a reference
		 * screenshot and validate the result against a configurable threshold
		 *
		 * @param {String} file - The path to the reference image
		 * @param {String} modRoot - The path to the root of the project being tested
		 * @param {Object} options - The optional paramteres for the function
		 ****************************************************************************/
		webdriver.addPromiseMethod('screenshotTest', (file, modRoot, { thresh = 0.20, overwrite = false } = {}) => {
			return new Promise((resolve, reject) => {
				driver
					.sleep(2000)
					.getPlatform()
					.then(platform => {
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
													.takeScreenshot()
													.then(screenshot => processImg(file, modRoot, screenshot, thresh, overwrite, dimensions))
													.then(() => resolve())
													.catch(err => reject(err));
											});
									});
								break;

							case 'Android':
								driver
									.sleep(2000)
									.elementsById('decor_content_parent')
									.then(elements => {
										if (elements.length > 0) {
										// Get the size of the window frame
											driver
												.elementById('decor_content_parent')
												.getBounds()
												.then(bounds => {
												// Create the config for PNGCrop to use
													const dimensions = {
														height: (bounds.height),
														width: (bounds.width),
														top: (bounds.y)
													};

													// Take the screenshot
													driver
														.takeScreenshot()
														.then(screenshot => processImg(file, modRoot, screenshot, thresh, overwrite, dimensions))
														.then(() => resolve())
														.catch(err => reject(err));
												});
										} else {
										// Take the screenshot
											driver
												.takeScreenshot()
												.then(screenshot => processImg(file, modRoot, screenshot, thresh, overwrite))
												.then(() => resolve())
												.catch(err => reject(err));
										}
									});
						}
					});
			});
		});

		/*************************************************************************
		 * Compares a screenshot of the app in its current state, to a stored
		 * reference image to see how they match. (Leaves the status bar in, for
		 * tests which may require it).
		 ************************************************************************/
		webdriver.addPromiseMethod('fullScreenshotTest', (file, modRoot, { thresh = 0.20, overwrite = false } = {}) => {
			return new Promise((resolve, reject) => {
				driver
					.sleep(2000)
					.takeScreenshot()
					.then(screenshot => processImg(file, modRoot, screenshot, thresh, overwrite))
					.then(() => resolve())
					.catch(err => reject(err));
			});
		});
	}
}

module.exports = WebDriver_Helper;

/*******************************************************************************
 * Take the base64 encoded string of the screenshot, and compare it to the
 * stored reference image, then return the result.
 *
 * @param {String} file - The path to the reference image
 * @param {String} modRoot - The path to the root of the project being tested
 * @param {String} screenshot - The base64 encoded string representing the image
 * @param {Decimal} thresh - A custom defined image matching threshold
 * @param {Boolean} overwrite - Flag triggers overwrite of reference screenshot
 * @param {Object} dimensions - The dimensions to crop the image down to
 ******************************************************************************/
function processImg(file, modRoot, screenshot, thresh, overwrite, dimensions) {
	return new Promise((resolve, reject) => {
		let
			screenshotDir = path.join(modRoot, 'Screen_Shots'),
			screenshotPath = path.join(screenshotDir, path.basename(file));

		fs.ensureDirSync(screenshotDir);

		if (overwrite) {
			output.debug(`Overwite found, writing image to ${file}`);
			writeImg(screenshot, file)
				.then(() => cropImg(file, dimensions))
				.then(() => resolve())
				.catch(err => reject(err));
		} else {
			const elem = path.parse(screenshotPath);

			screenshotPath = path.format({
				name: `${elem.name}_Test`,
				root: elem.root,
				dir: elem.dir,
				ext: elem.ext
			});

			output.debug(`Comparing ${screenshotPath} to ${file}`);
			writeImg(screenshot, screenshotPath)
				.then(() => cropImg(screenshotPath, dimensions))
				.then(() => compImg(screenshotPath, file, thresh))
				.then(() => resolve())
				.catch(err => reject(err));
		}
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
			if (writeErr) {
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

/*******************************************************************************
 * Generate a dynamic element identifier, based on the mobile OS, and the type
 * of element
 *
 * @param {String} elementType - The type of UI element to identify
 * @param {String} platform - The mobile OS to identify the element for
 ******************************************************************************/
function getElement(elementType, platform) {
	switch (platform) {
		case 'iOS':
			switch (elementType) {
				case 'TextField':
					return 'XCUIElementTypeTextField';

				case 'TextArea':
					return 'XCUIElementTypeTextView';

				case 'TableView':
					return 'XCUIElementTypeTable';

				case 'Button':
					return 'XCUIElementTypeButton';

				case 'TableViewRow':
					return 'XCUIElementTypeCell';

				case 'OptionDialog':
					return 'XCUIElementTypeSheet';

				case 'SearchField':
					return 'XCUIElementTypeSearchField';

				case 'DatePicker':
					return 'XCUIElementTypeDatePicker';

				case 'Window':
					return 'XCUIElementTypeWindow';

				case 'WebView':
					return 'XCUIElementTypeWebView';

				case 'ImageView':
					return 'XCUIElementTypeImage';

				case 'StatusBar':
					return 'XCUIElementTypeStatusBar';

				case 'KeyBoard':
					return 'XCUIElementTypeKeyboard';

				case 'ToolBar':
					return 'XCUIElementTypeToolbar';

				case 'PagingControl':
					return 'XCUIElementTypePageIndicator';

				case 'Slider':
					return 'XCUIElementTypeSlider';

				case 'Switch':
					return 'XCUIElementTypeSwitch';

				case 'ScrollView':
					return 'XCUIElementTypeScrollView';

				case 'Other':
					return 'XCUIElementTypeOther';
			}
			break;

		case 'Android':
			switch (elementType) {
				case 'TextField':
					return 'android.widget.TextView';

				case 'TextArea':
					return 'android.widget.EditText';

				case 'DatePicker':
					return 'android.widget.DatePicker';

				case 'SearchField':
					return 'android.widget.EditText';

				case 'TableView':
					return 'android.widget.ListView';

				case 'Window':
					return 'android.view.ViewGroup';

				case 'TableViewRow':
					return 'android.view.ViewGroup';

				case 'WebView':
					return 'android.webkit.WebView';

				case 'ImageView':
					return 'android.widget.ImageView';

				case 'StatusBar':
					return 'android.view.View'; // Could be any number of views, needs to be more specific

				case 'Slider':
					return 'android.widget.SeekBar';

				case 'Switch':
					return 'android.widget.Switch';

				case 'ScrollView':
					return 'android.widget.ScrollView';

				case 'Other':
					return 'android.view.ViewGroup';
			}
			break;
	}
}
