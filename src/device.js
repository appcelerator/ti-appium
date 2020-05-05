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
	 * Kill the iOS simulator using it's UDID, and then repeatedly check whether
	 * it has fully shut down
	 *
	 * @param {String} simName - The name of the iOS device to find
	 * @param {String} simVersion - The version of the iOS device to find
	 * @param {Object} opts - Optional arguments
	 * @param {Int} opts.initialWait - How long to wait for the first boot check
	 * @param {Int} opts.intervalWait - How long to wait between each check following the first
	 */
	static async killSim(simName, simVersion, { initialWait = 10000, intervalWait = 5000 } = {}) {
		if (!simName) { throw new Error('Empty simulator name argument passed'); }
		if (!simVersion) { throw new Error('Empty simulator version passed'); }

		output.debug(`Shutting Down the iOS Simulator: ${simName} (${simVersion})`);

		const udid = getUdid(simName, simVersion);

		output.debug(`Found UDID for Simulator: ${udid}`);

		childProcess.execSync(`xcrun simctl shutdown ${udid}`);

		await isShutdown(simName, simVersion, initialWait, intervalWait);

		// The simulator process hangs around even after the sim itself is shut down
		childProcess.spawn('killall', [ 'Simulator' ]);
	}

	/**
	 * Get the boot status of an iOS simulator via its UDID
	 *
	 * @param {String} simName - The name of the iOS device to find
	 * @param {String} simVersion - The version of the iOS device to find
	 */
	static getSimState(simName, simVersion) {
		if (!simName) { throw new Error('Empty simulator name argument passed'); }
		if (!simVersion) { throw new Error('Empty simulator version passed'); }

		return getState(simName, simVersion);
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
 * Use the status of the simulator to determine whether the device is shutdown. The
 * initial wait value is used because a simulator will sometimes show as shutdown
 * before it really is and then change it's mind back to booted. So we use a long
 * wait to allow it to get past this phase
 * @private
 *
 * @param {String} simName - The name of the iOS device to find
 * @param {String} simVersion - The version of the iOS device to find
 * @param {Int} initialWait - How long to wait for the first boot check
 * @param {Int} intervalWait - How long to wait between each check following the first
 */
function isShutdown(simName, simVersion, initialWait, intervalWait) {
	return new Promise((resolve, reject) => {
		output.debug(`Starting Check for Simulator Shutdown, Waiting ${initialWait}ms for First Check Then Every ${intervalWait}ms`);
		setTimeout(() => {
			let count = 0;

			const interval = setInterval(() => {
				let state = getState(simName, simVersion);

				count++;

				output.debug(`${simName} (${simVersion}) is Currently ${state}`);

				if (state === 'Shutdown') {
					clearInterval(interval);
					return resolve();
				} else if (count >= 20) {
					clearInterval(interval);
					return reject('iOS simulator didn\'t shutdown in expected time, you may expierience instability');
				}
			}, intervalWait);
		}, initialWait);
	});
}

/**
 * Get the boot status of an iOS simulator via its UDID
 * @private
 *
 * @param {String} simName - The name of the iOS device to find
 * @param {String} simVersion - The version of the iOS device to find
 */
function getState(simName, simVersion) {
	const
		versionParts = simVersion.split('.'),
		major = versionParts[0],
		minor = versionParts[1];

	const udid = getUdid(simName, simVersion);

	const xcrunOut = childProcess.execSync('xcrun simctl list --json');

	const xcrunSims = JSON.parse(xcrunOut).devices[`com.apple.CoreSimulator.SimRuntime.iOS-${major}-${minor}`];

	try {
		for (const xcrunSim of xcrunSims) {
			if (xcrunSim.udid === udid) {
				return xcrunSim.state;
			}
		}
	} catch (e) {
		throw new Error(`An issue occured trying to get the boot status of iOS simulator "${simName} (${simVersion})", do you have this simulator configured?`);
	}

	throw new Error(`Cannot retrieve a status for simulator ${simName} (${simVersion})`);
}

/**
 * Get the UDID of an iOS simulator using the Titanium CLI
 * @private
 *
 * @param {String} simName - The name of the iOS device to find
 * @param {String} simVersion - The version of the iOS device to find
 */
function getUdid(simName, simVersion) {
	const tiOut = childProcess.execSync('ti info -t ios -o json');

	const tiSims = JSON.parse(tiOut).ios.simulators.ios[simVersion];

	try {
		for (const tiSim of tiSims) {
			if (tiSim.name === simName) {
				return tiSim.udid;
			}
		}
	} catch (e) {
		throw new Error(`An issue occured trying to find the UDID of iOS simulator "${simName} (${simVersion})", do you have this simulator configured?`);
	}

	throw new Error(`Cannot find a UDID for simulator ${simName} (${simVersion})`);
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
