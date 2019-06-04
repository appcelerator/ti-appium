'use strict';

const
	path = require('path'),
	ps = require('ps-list'),
	ioslib = require('ioslib'),
	output = require('./output.js'),
	childProcess = require('child_process');

/**
 * @class Device_Helper
 * @desc
 * Devices handling class, used to make shortcuts around the launching and
 * shutting down of emulators. Also has functions for finding iOS certificates
 * and provisioning profiles.
 */
class Device_Helper {
	/**
	 * Launch the emulator specified in the Test_Config.js for the current test
	 *
	 * @param {String} deviceName - The name of the AVD emulator used for testing
	 * @param {Object} opts - Optional Arguments
	 * @param {String[]} opts.args - Additional AVD arguments to boot emulator with
	 * @param {int} opts.firstCheck - Time until the first emulator check is made (ms)
	 * @param {int} opts.freqCheck - Time between the emulator checks being made (ms)
	 */
	static async launchEmu(deviceName, { args = [], firstCheck = 10000, freqCheck = 2000 } = {}) {
		// Validate the arguments are valid
		if (!Array.isArray(args)) {
			throw (new Error('Arguments must be an array'));
		}

		if (!Number.isInteger(firstCheck) || firstCheck < 0) {
			throw (new Error('firstCheck must be a positive integer'));
		}

		if (!Number.isInteger(freqCheck) || freqCheck < 0) {
			throw (new Error('freqCheck must be a positive integer'));
		}

		try {
			output.debug('Checking if emulator is already booted');

			await getAndroidPID(deviceName);
		} catch (err) {
			// Assume this is just down to no booted emulator

			output.debug(`Can't find a running instance, launching Android emulator '${deviceName}'`);

			let
				cmd = path.join(process.env.ANDROID_HOME, 'emulator', 'emulator'),
				cmdArgs = [ '-avd', deviceName, '-wipe-data' ];

			if (args) {
				cmdArgs = cmdArgs.concat(args);
			}

			childProcess.spawn(cmd, cmdArgs);

			await checkBooted('emulator', firstCheck, freqCheck);
		}

		output.debug(`${deviceName} is booted`);
	}

	/**
	 * Launch a Genymotion device to run tests on. The name is retrieved from the
	 * Test_Config.js file
	 *
	 * @param {String} deviceName - The name of the Genymotion emulator used for
	 *													 		testing
	 */
	static async launchGeny(deviceName) {
		try {
			output.debug('Checking if Genymotion emulator is already booted');

			await getAndroidPID(deviceName);
		} catch (err) {
			// Assume this is just down to no booted emulator

			output.debug(`Can't find a running instance, booting Genymotion emulator '${deviceName}'`);

			const
				cmd = (process.platform === 'darwin') ? path.join('/', 'Applications', 'Genymotion.app', 'Contents', 'MacOS', 'player.app', 'Contents', 'MacOS', 'player') : path.join(), // TODO: Find Windows path to player
				args = [ '--vm-name', deviceName ];

			childProcess.spawn(cmd, args, { shell: true });

			await checkBooted('genymotion', 10000, 3000);
		}

		output.debug(`${deviceName} is booted`);
	}

	/**
	 * Kill all the iOS simulators using the killall command
	 */
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

	/**
	 * Kill all the Android emulators.
	 *
	 * @param {String} deviceName - The name of the Android device to kill
	 */
	static async killEmu(deviceName) {
		const devicePID = await getAndroidPID(deviceName);

		output.debug(`Found Android emulator PID: ${devicePID}`);

		if (process.platform === 'win32') {
			output.debug('Detected Windows, killing emulator with taskkill command');
			await childProcess.execSync(`taskkill /F /PID ${devicePID}`);
		} else {
			output.debug('Presuming UNIX, killing emulator with kill command');
			await childProcess.execSync(`kill -9 ${devicePID}`);
		}
	}

	/**
	 * Use ioslib to probe the machine for a particular iOS certificate, then
	 * return the certificate object.
	 *
	 * @param {String} type - The type of operation the cert is defined for
	 * @param {String} search - Part of the cert name, used to help locate it
	 */
	static async getCert(type, search) {
		if (process.platform !== 'darwin') {
			return undefined;
		}

		const
			certs = await ioslib.certs.getCerts(),
			subCerts = certs[type],
			valid = [ 'developer', 'distribution' ];

		if (!valid.includes(type)) {
			throw Error(`Argument '${type}' is not a valid type of certificate`);
		}

		let foundCert;

		subCerts.forEach(cert => {
			if (cert.name.includes(search)) {
				foundCert = cert;
			}
		});

		if (!foundCert) {
			throw Error(`No certificate found with a name including '${search}'`);
		}

		return foundCert;
	}

	/**
	 * Use ioslib to probe the machine for a particular iOS provisioning profile,
	 * then return the provisioning profile object.
	 *
	 * @param {String} type - The type of operation the pp is defined for
	 * @param {String} search - Part of the pp name, used to help locate it
	 */
	static async getProfile(type, search) {
		if (process.platform !== 'darwin') {
			return undefined;
		}

		const
			profiles = await ioslib.provisioning.getProvisioningProfiles(),
			subProfiles = profiles[type],
			valid = [ 'adhoc', 'development', 'distribution' ];

		if (!valid.includes(type)) {
			throw Error(`Argument '${type}' is not a valid type of provisioning profile`);
		}

		let foundProfile;

		subProfiles.forEach(profile => {
			if (profile.name === search) {
				foundProfile = profile;
			}
		});

		if (!foundProfile) {
			throw Error(`No provisioning profile found with a name matching '${search}'`);
		}

		return foundProfile;
	}
}

/**
 * Search the running processes on the system, and look for one with the
 * Android device name that we booted for testing.
 * @private
 *
 * @param {String} deviceName - The name of the Android device to find
 */
async function getAndroidPID(deviceName) {
	try {
		const
			list = await ps(),
			proc = list.find(x => x.cmd.includes(deviceName)),
			pid = proc.pid;

		return pid;
	} catch (err) {
		throw Error(`Cannot find an Android PID for ${deviceName}`);
	}
}

/**
 * Validate to see if there is a process running for this emulator.
 * @private
 *
 * @param {String} platform - Device we need, supports emulator or genymotion
 * @param {int} firstCheck - Time until the first emulator check is made (ms)
 * @param {int} freqCheck - Time between the emulator checks being made (ms)
 */
function checkBooted(platform, firstCheck, freqCheck) {
	return new Promise((resolve, reject) => {
		let
			count = 0,
			cmd = (platform === 'emulator' || platform === 'genymotion') ? 'adb -e shell getprop init.svc.bootanim' : 'adb -d shell getprop init.svc.bootanim';

		output.debug(`Checking emulator status in ${firstCheck}ms`);
		output.debug(`Checking every ${freqCheck}ms following that`);

		setTimeout(() => {
			const interval = setInterval(() => {
				childProcess.exec(cmd, (error, stdout, stderr) => {
					count++;

					if (stdout.toString().indexOf('stopped') > -1) {
						clearInterval(interval);
						return resolve();
					} else if (count >= 20) {
						clearInterval(interval);
						return reject('Emulator didn\'t boot in 20 sequences, assuming an issue has occured');
					}

					if (stderr) {
						output.debug(stderr);
					}

					if (error) {
						clearInterval(interval);
						return reject(error);
					} else {
						output.debug(`${platform} still booting`);
					}
				});
			}, freqCheck);
		}, firstCheck);
	});
}

module.exports = Device_Helper;
