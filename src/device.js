'use strict';

const
	path = require('path'),
	ps = require('ps-list'),
	output = require('./output.js'),
	childProcess = require('child_process');

class Device_Helper {
	/*****************************************************************************
	 * Launch the emulator specified in the Test_Config.js for the current test
	 *
	 * @param {String} deviceName - The name of the AVD emulator used for testing
	 ****************************************************************************/
	static launchEmu(deviceName) {
		return new Promise(async (resolve) => {
			output.debug('Checking if emulator is already booted');
			const booted = await getAndroidPID(deviceName);

			if (booted) {
				output.debug('Device is already booted');

				return resolve();
			} else {
				output.debug(`Launching Android device '${deviceName}'`);

				const
					cmd = path.join(process.env.ANDROID_HOME, 'emulator', 'emulator'),
					args = [ '-avd', deviceName, '-wipe-data' ];

				childProcess.spawn(cmd, args);

				checkBooted('emulator')
					.then(() => {
						return resolve();
					}).catch((err) => {
						output.debug(err);
					});
			}
		});
	}

	/*****************************************************************************
	 * Launch a Genymotion device to run tests on. The name is retrieved from the
	 * Test_Config.js file
	 *
	 * @param {String} deviceName - The name of the Genymotion emulator used for
	 *													 		testing
	 ****************************************************************************/
	static launchGeny(deviceName) {
		return new Promise(async (resolve) => {
			output.debug('Checking if Genymotion device is already booted');

			const booted = await getAndroidPID(deviceName);

			if (booted) {
				output.debug('Device is already booted');

				return resolve();
			} else {
				output.step(`Booting Genymotion Emulator '${deviceName}'`);

				const
					cmd = (global.hostOS === 'Mac') ? path.join('/', 'Applications', 'Genymotion.app', 'Contents', 'MacOS', 'player.app', 'Contents', 'MacOS', 'player') : path.join(), // TODO: Find Windows path to player
					args = [ '--vm-name', deviceName ];

				childProcess.spawn(cmd, args, { shell: true });

				checkBooted('genymotion')
					.then(() => {
						return resolve();
					}).catch((err) => {
						output.debug(err);
					});
			}
		});
	}

	/*******************************************************************************
	 * Kill all the iOS simulators using the killall command
	 ******************************************************************************/
	static killSim() {
		return new Promise(resolve => {
			output.debug('Shutting Down the iOS Simulator');

			childProcess.execSync('xcrun simctl shutdown booted');

			// Whilst the above does kill the simulator, it can leave processes running, so just nuke it after a period for safe shutdown
			setTimeout(() => {
				childProcess.spawn('killall', [ 'Simulator' ]);
				resolve();
			}, 5000);
		});
	}

	/*******************************************************************************
	 * Kill all the Android emulators.
	 *
	 * @param {String} deviceName - The name of the Android device to kill
	 ******************************************************************************/
	static async killEmu(deviceName) {
		const devicePID = await getAndroidPID(deviceName);

		output.debug(`Found Android emulator PID: ${devicePID}`);

		if (process.platform === 'win32') {
			output.debug('Detected Windows, killing emulator with taskkill command');
			await childProcess.execSync(`taskkill /F /PID ${devicePID}`);
		} else {
			output.debug('Presuming MacOS, killing emulator with kill command');
			await childProcess.execSync(`kill -9 ${devicePID}`);
		}
	}
}

/*******************************************************************************
 * Search the running processes on the system, and look for one with the
 * Android device name that we booted for testing.
 *
 * @param {String} deviceName - The name of the Android device to find
 ******************************************************************************/
async function getAndroidPID(deviceName) {
	try {
		const
			list = await ps(),
			proc = list.find(x => x.cmd.includes(deviceName)),
			pid = proc.pid;

		return pid;
	} catch (err) {
		output.debug(`Cannot find an Android PID for ${deviceName}`);

		return null;
	}
}

/*******************************************************************************
 * Validate to see if there is a process running for this emulator.
 *
 * @param {String} platform - Device we need, supports emulator or genymotion
 ******************************************************************************/
function checkBooted(platform) {
	return new Promise((resolve, reject) => {
		let cmd = (platform === 'emulator' || platform === 'genymotion') ? 'adb -e shell getprop init.svc.bootanim' : 'adb -d shell getprop init.svc.bootanim';
		const interval = setInterval(() => {
			childProcess.exec(cmd, (error, stdout, stderr) => {

				if (stdout.toString().indexOf('stopped') > -1) {
					clearInterval(interval);
					output.debug(`${platform} booted`);
					resolve(true);
				}
				if (stderr) {
					output.debug(stderr);
				}
				if (error) {
					return reject(error);
				} else {
					output.debug(`${platform} still booting`);
				}
			});
		}, 5000);
	});
}

module.exports = Device_Helper;
