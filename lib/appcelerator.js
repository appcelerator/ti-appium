'use strict';

const
	path = require('path'),
	fs = require('fs-extra'),
	ioslib = require('ioslib'),
	output = require('./output.js'),
	spawn = require('child_process').spawn,
	exec = require('child_process').execSync;

class Appc_Helper {
	/*****************************************************************************
	 * Login to the Appcelerator CLI using the login command.
	 *
	 * @param {Object} appc - The details for the Appcelerator run
	 * @param {String} env - The Appcelerator environment to login to.
	 ****************************************************************************/
	static async login(appc, env) {
		output.step(`Logging into the Appcelerator CLI as '${appc.username}'`);

		output.debug('Logging out of the current session');
		await exec('appc logout');

		output.debug(`Setting environment to ${env}`);
		await exec(`appc config set defaultEnvironment ${env}`);

		output.debug('Logging into the CLI');
		let loginReturn = await exec(`appc login --username ${appc.username} --password ${appc.password} -O ${appc.organisation} --no-prompt`).toString();

		if(loginReturn.includes('Login required to continue') || loginReturn.includes('Invalid username or password')) {
			throw Error('Error During Appc CLI Login');
		} else {
			output.finish();

			return;
		}
	}

	/*****************************************************************************
	 * Take the passed SDK, and attempt to install it. If it is a straight defined
	 * SDK, then install it. Otherwise if it is a branch, get the latest version
	 * of it.
	 *
	 * @param {Object} appc - The details for the Appcelerator run
	 ****************************************************************************/
	static installSDK(appc) {
		output.step(`Installing Appcelerator SDK '${appc.sdk}'`);

		return new Promise((resolve, reject) => {
			let
				sdk,
				cmd = 'appc',
				args = ['ti', 'sdk', 'install', '-b', appc.sdk, '-d', '--no-prompt', '--username', appc.username, '--password', appc.password, '-O', appc.organisation],
				error = false;

			let
				foundStr,
				installStr = /successfully installed!/;

			if((appc.sdk.split('.')).length > 1) {
				foundStr = /is already installed!/;

				output.debug('Requested SDK is a specific version, not a branch, removing \'-b\' flag');
				// Remove the branch flag if downloading a specific SDK
				let index = args.indexOf(args.find(element => element === '-b'));

				args.splice(index, 1);
			} else {
				foundStr = /is currently the newest version available\./;
			}

			output.debug('Beginning SDK install');
			const prc = spawn(cmd, args, {
				shell: true
			});

			prc.stdout.on('data', data => {
				output.debug(data.toString());
				if(data.toString().match(installStr)) {
					output.debug('Installed the requested SDK');
					sdk = data.toString().match(/\w+\.\w+\.\w+\.\w+/)[0];
				}
				if(data.toString().match(foundStr)) {
					output.debug('Found the requested SDK');
					sdk = data.toString().match(/\w+\.\w+\.\w+\.\w+/)[0];
				}
			});

			prc.stderr.on('data', data => {
				output.debug(data.toString());
				// Appc CLI doesn't provide an error code on fail, so need to monitor the output and look for issues manually
				// If statement is there so that [WARN] flags are ignored on stderr
				if(data.toString().includes('[ERROR]')) {
					error = true;
				}
			});

			prc.on('exit', code => {
				if(code !== 0 || error === true) {
					reject('Error installing Titanium SDK');
				} else {
					try {
						// If the SDK was already installed, the -d flag will have been ignored
						output.debug('Selecting the SDK');
						exec(`appc ti sdk select ${sdk}`);

						output.finish(resolve, sdk);
					} catch (err) {
						reject(err);
					}
				}
			});
		});
	}

	/*****************************************************************************
	 * Install the latest version of the required CLI version for testing.
	 *
	 * @param {Object} appc - The details for the Appcelerator run
	 ****************************************************************************/
	static async installCLI(appc) {
		output.step(`Installing CLI Version '${appc.cli}'`)
		try {
			output.debug('Fetching CLI version from the production environment');
			await exec(`appc use ${appc.cli}`, {
				stdio: [0]
			});
		} catch (err) {
			if(err.toString().includes(`The version specified ${appc.cli} was not found`)) {
				// Go to the pre-production environment
				output.debug('Couldn\'t find the requested CLI version in production, switching to pre-production');
				await this.login(appc, 'preproduction');

				// Check if the CLI version we want to use is installed
				output.debug(`Checking if the latest version of ${appc.cli} is installed`);
				const
					clis = JSON.parse(await exec('appc use -o json --prerelease')),
					latest = clis.versions.find(element => element.includes(appc.cli)),
					installed = clis.installed.includes(latest);

				if(!latest) {
					throw (new Error(`No Version Found For CLI ${appc.cli}`));
				}

				// If not, install it and set it as default
				if(installed) {
					output.debug(`Latest already installed, selecting ${latest}`);
				} else {
					output.debug(`Latest not installed, downloading ${latest}`);
				}

				await exec(`appc use ${latest}`);

				// Return to the production environment
				output.debug('Return to the production environment');
				await this.login(appc, 'production');
			}
		}

		output.finish();
	}

	/*****************************************************************************
	 * Build a specified application for a given platform. Also allows users to
	 * specify their own arguments.
	 *
	 * @param {String} dir - The path to the application root
	 * @param {String} platform - The mobile OS the app is being built for
	 * @param {Array} args - Any additional arguments to be passed to the command
	 ****************************************************************************/
	static build(dir, platform, args) {
		return new Promise((resolve, reject) => {
			// Validate the arguments are valid
			if(args && !Array.isArray(args)) reject('Arguments must be an array');

			// Generate a path to the tiapp.xml file
			const tiappFile = path.join(dir, 'tiapp.xml');

			// Prepare the tiapp.xml before build
			const
				tiapp = require('tiapp.xml').load(tiappFile),
				sdks = exec('appc ti sdk list -o json'),
				sdk = JSON.parse(sdks).activeSDK,
				appName = tiapp.name;

			output.debug(`Building app '${appName}'`);
			output.debug(`Setting tiapp.xml SDK to ${sdk}`);

			// Write the currently selected SDK, this should have been set to the
			// requested branch/SDK in the SDK install step
			tiapp.sdkVersion = sdk;

			output.debug('Removing iOS SOASTA references from the tiapp.xml')

			// Remove SOASTA module reference
			tiapp.removeModule('com.soasta.touchtest', 'iphone');
			// Remove SOASTA property reference
			tiapp.removeProperty('com-soasta-touchtest-ios-appId');

			tiapp.write();

			// Create our default arguments
			let cmdArgs = ['run', '-f', '-d', dir, '-p', platform, '--no-prompt', '--build-only'];

			// Add any user defined arguments into the command
			if(args) cmdArgs = cmdArgs.concat(args);

			// Build a command string to display to the console
			let argstring = 'appc';

			cmdArgs.forEach(arg => {
				argstring = `${argstring} ${arg}`;
			});

			output.debug(`Invoking command: ${argstring}`);

			// Execute the run command, and listen for events
			const prc = spawn('appc', cmdArgs);

			prc.stdout.on('data', data => {
				output.debug(data.toString());
			});

			prc.stderr.on('data', data => {
				output.debug(data.toString());
				// Appc CLI doesn't always provide an error code on fail, so need to monitor the output and look for issues manually
				// If statement is there so that [WARN] flags are ignored on stderr
				if(data.toString().includes('[ERROR]')) reject(data.toString().replace('[ERROR] ', ''));
			});

			prc.on('exit', code => {
				const appPath = this.createAppPath(dir, platform, appName);

				(code === 0 && appPath) ? resolve(appPath): reject('Failed on application build');
			});
		});
	}

	static createAppPath(dir, platform, appName) {
		// NOTE: Could we maybe assume the basename of the passed dir is the same as the app name?
		switch (platform) {
		case 'ios':
			const
				products = path.join(dir, 'build', 'iphone', 'build', 'Products'),
				productDir = fs.readdirSync(products)[0],
				appPath = path.join(products, productDir, `${appName}.app`);

			return appPath;
			break;

		case 'android':
			return path.join(dir, 'build', 'android', 'bin', `${appName}.apk`);
			break;

		case 'windows':
			return path.join(dir); // FIXME: Find Windows path
			break;

		default:
			throw Error('Invalid platform passed to function');
		}
	}

	/*****************************************************************************
	 * Build a specified application for a given platform. Also allows users to
	 * specify their own arguments
	 *
	 * @param {String} cmd - The command to be run on the Appcelerator CLI
	 ****************************************************************************/
	static runner(args) {
		return new Promise((resolve, reject) => {
			// Build a command string to display to the console
			let argstring = 'appc';

			args.forEach(arg => {
				argstring = `${argstring} ${arg}`;
			});

			output.debug(`Invoking command: ${argstring}`);

			const prc = spawn('appc', args);

			prc.stdout.on('data', data => {
				output.debug(data.toString());
			});

			prc.stderr.on('data', data => {
				return reject(data.toString());
			});

			prc.on('exit', code => {
				(code === 0) ? resolve(): reject(`Command exited with code: ${code}`);
			});
		});
	}
}

module.exports = Appc_Helper;