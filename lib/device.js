'use strict';

const
	path = require('path'),
	childProcess = require('child_process'),
	output = require('./output.js');

class Device_Helper {
	/*****************************************************************************
	 * Launch the emulator specified in the Test_Config.js for the current test
	 *
	 * @param {String} devName - The name of the AVD emulator used for testing
	 ****************************************************************************/
	static launchEmu(devName, platform) {
		return new Promise(resolve => {
			output.info(`Launching Android device '${devName}'... `);

			if(global.androidPID) {
				output.skip(resolve, null);
			} else {
				const
					cmd = path.join(process.env.ANDROID_HOME, 'emulator', 'emulator'),
					args = ['-avd', devName, '-wipe-data'];

				const prc = childProcess.spawn(cmd, args);

				global.androidPID = prc.pid;

				checkBooted(platform).then(() => {
					return output.finish(resolve);
				});
			}
		});
	}

	/*****************************************************************************
	 * Launch a Genymotion device to run tests on. The name is retrieved from the
	 * Test_Config.js file
	 *
	 * @param {String} devName - The name of the Genymotion emulator used for
	 *													 testing
	 ****************************************************************************/
	static launchGeny(devName, platform) {
		return new Promise(resolve => {
			output.info(`Booting Genymotion Emulator '${devName}'`);

			if(global.genymotionPID) {
				output.skip(resolve, null);
			} else {
				const
					cmd = (global.hostOS === 'Mac') ? path.join('/', 'Applications', 'Genymotion.app', 'Contents', 'MacOS', 'player.app', 'Contents', 'MacOS', 'player') : path.join(), // TODO: Find Windows path to player
					args = ['--vm-name', devName];

				const prc = childProcess.spawn(cmd, args, { shell: true });

				global.genymotionPID = prc.pid;

				checkBooted(platform).then(() => {
					return output.finish(resolve);
				});
			}
		});
	}

	/*****************************************************************************
	 * Kill all the iOS simulators using the killall command
	 ****************************************************************************/
	static killSim() {
		return new Promise(resolve => {
			output.info('Shutting Down the iOS Simulator... ');

			childProcess.execSync('xcrun simctl shutdown booted');

			// Whilst the above does kill the simulator, it can leave processes running, so just nuke it after a period for safe shutdown
			setTimeout(() => {
				childProcess.spawn('killall', ['Simulator']);
				output.finish(resolve);
			}, 5000);
		});
	}

	/*****************************************************************************
	 * Kill all the test simulators and emulators in the event of SIGINT.
	 ****************************************************************************/
	static quickKill() {
		delete global.androidPID;
		delete global.genymotionPID;
		if(global.hostOS === 'Mac') {
			childProcess.spawn('xcrun', ['simctl', 'shutdown', 'booted']);
			childProcess.spawn('pkill', ['-9', 'qemu-system-i386']);
			childProcess.spawn('pkill', ['-9', 'player']);
		}
		if(global.hostOS === 'Windows') {
			childProcess.spawn('tskill', ['qemu-system-i386']);
			childProcess.spawn('tskill', ['player']);
		}
	}
}

/*******************************************************************************
 * Validate to see if there is a process running for this emulator.
 ******************************************************************************/
function checkBooted(platform) {
	return new Promise((resolve) => {
		let cmd = (platform === 'emulator' || platform === 'genymotion') ? 'adb -e shell getprop init.svc.bootanim' : 'adb -d shell getprop init.svc.bootanim';
		const interval = setInterval(() => {
			childProcess.exec(cmd, function (error, stdout, stderr) {

				if(stdout.toString().indexOf('stopped') > -1) {
					clearInterval(interval);
					output.info(`${platform} Booted`);
					resolve(true);
				}
				if(stderr) {
					output.error(stderr);
				}
				if(error) {
					output.error(error);
				} else {
					output.info(`${platform} still Booting`);
				}
			});
		}, 1000);
	});
}

module.exports = Device_Helper;