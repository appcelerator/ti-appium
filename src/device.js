'use strict';

const
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
		const list = await ps();

		let pid;

		if (process.platform === 'win32') {
			const proc = list.find(x => x.name.includes('qemu-system-x86_64'));
			pid = proc.pid;
		} else {
			const proc = list.find(x => x.cmd.includes(deviceName));
			pid = proc.pid;
		}

		return pid;
	} catch (err) {
		throw Error(`Cannot find an Android PID for ${deviceName}`);
	}
}

module.exports = Device_Helper;
