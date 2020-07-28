'use strict';

const
	path = require('path'),
	fs = require('fs-extra'),
	output = require('./output.js'),
	tisdk = require('titaniumlib').sdk,
	spawn = require('child_process').spawn,
	exec = require('child_process').execSync;

/**
 * @class Appc_Helper
 * @desc
 * Commands to interact with the Appcelerator and Titanium CLI. This contains a
 * series of specific commands, or a more general runner command for your own
 * CLI interactions.
 */
class Appc_Helper {
	/**
	 * Login to the Appcelerator CLI using the login command.
	 *
	 * @param {Object} appc - The details for the Appcelerator run
	 * @param {String} appc.username - The username to authenticate with
	 * @param {String} appc.password - The password to authenticate with
	 * @param {String} appc.organisation - The relevant org ID to log in to
	 * @param {String} env - The Appcelerator environment to login to.
	 */
	static async login(appc, env) {
		output.debug(`Logging into the Appcelerator CLI as '${appc.username}'`);

		output.debug('Logging out of the current session');
		await exec('appc logout');

		output.debug(`Setting environment to ${env}`);
		await exec(`appc config set defaultEnvironment ${env}`);

		output.debug('Logging into the CLI');
		let loginReturn = await exec(`appc login --username ${appc.username} --password ${appc.password} -O ${appc.organisation} --no-prompt`).toString();

		if (loginReturn.includes('Login required to continue') || loginReturn.includes('Invalid username or password')) {
			throw Error('Error During Appc CLI Login');
		} else {
			return;
		}
	}

	/**
	 * Takes in an SDK identifier and attempts to resolve it to the applicable SDK
	 * version. Can take a release version, pre-release version, or branch
	 * identifier and attempts to resolve it to an installable identifier.
	 *
	 * @param {String} sdk - The version or branch of the SDK to validate
	 */
	static async parseSDK(sdk) {
		output.debug(`Parsing the validity of SDK version ${sdk}`);

		const
			sdkTestOne = new RegExp(/^\d+\.\d+\.\d+\.GA$/),
			sdkTestTwo = new RegExp(/^\d+\.\d+\.\d+\.v\d+$/),
			sdkTestThree = new RegExp(/^\d+_\d+_X$/);

		if (sdkTestOne.test(sdk) || sdk === 'latest') {
			// Matches the version profile for a GA release
			output.debug('SDK version passed has been identified as type release version');

			const releases = Object.keys(await tisdk.getReleases(true));

			// Latest is kinda nasty to deal with as it isn't a branch or a pretty number
			if (sdk === 'latest') { sdk = releases[releases.length - 1]; }

			if (!releases.includes(sdk)) { throw new Error(`${sdk} isn't a valid release`); }

			return sdk;
		} else if (sdkTestTwo.test(sdk)) {
			// Matches the version profile for a test release
			output.debug('SDK version passed has been identified as type pre-release version');

			const branches = (await tisdk.getBranches()).branches;

			const temp = `${(sdk.split('.').slice(0, 2).join('_'))}_X`;

			if (!branches.includes(temp)) {
				output.debug(`Can't find a branch matching ${temp}, checking master and next`);
				const
					masterBuilds = Object.keys(await tisdk.getBuilds('master')),
					nextBuilds = Object.keys(await tisdk.getBuilds('next'));

				if (masterBuilds.includes(sdk)) {
					output.debug(`Found SDK ${sdk} in branch master`);
					return sdk;
				}

				if (nextBuilds.includes(sdk)) {
					output.debug(`Found SDK ${sdk} in branch next`);
					return sdk;
				}

				throw new Error(`Can't find SDK ${sdk} in any branches`);
			}

			const builds = Object.keys(await tisdk.getBuilds(temp));

			if (!builds.includes(sdk)) { throw new Error(`SDK ${sdk} isn't a valid build within ${temp}`); }

			return sdk;
		} else if (sdkTestThree.test(sdk) || sdk === 'master' || sdk === 'next') {
			// Matches the profile for a branch name
			output.debug('SDK version passed has been identified as type branch');

			const branches = (await tisdk.getBranches()).branches;

			if (!branches.includes(sdk)) { throw new Error(`Branch ${sdk} isn't a valid branch`); }

			const builds = Object.keys(await tisdk.getBuilds(sdk));

			return builds[builds.length - 1];
		} else {
			throw new Error(`${sdk} isn't a valid Titanium release or branch`);
		}
	}

	/**
	 * Take the passed SDK, and attempt to install it. If it is a straight defined
	 * SDK, then install it. Otherwise if it is a branch, get the latest version
	 * of it.
	 *
	 * @param {String} sdk - The version or branch of the SDK to install
	 * @param {Boolean} force - Whether or not to force re-install the SDK
	 */
	static async installSDK(sdk, force = false) {
		// Validate that we're installing a valid SDK
		try {
			sdk = await this.parseSDK(sdk);
		} catch (e) { throw (e); }

		output.debug(`Identified ${sdk} as version to be installed`);

		const installs = await tisdk.getInstalledSDKs();

		// Check if the SDK is already installed
		for (const install of installs) {
			if (install.name === sdk && !force) {
				output.debug(`Found SDK ${sdk} already installed`);

				output.debug(`Selecting ${sdk}`);
				exec(`ti sdk select ${sdk}`);

				return sdk;
			}
		}

		// Install it if pre-checks haven't returned already
		try {
			output.debug(`Installing SDK ${sdk} with overwrite set to ${force}`);
			await tisdk.install({ uri: sdk, overwrite: force });
		} catch (e) { throw e; }

		output.debug(`Selecting ${sdk}`);
		exec(`ti sdk select ${sdk}`);

		return sdk;
	}

	/**
	 * Install the latest version of the required CLI version for testing.
	 *
	 * @param {Object} appc - The details for the Appcelerator run
	 * @param {String} appc.cli - The version of the CLI to install
	 * @param {String} appc.username - The username to authenticate with
	 * @param {String} appc.password - The password to authenticate with
	 * @param {String} appc.organisation - The relevant org ID to log in to
	 */
	static async installCLI(appc) {
		output.debug(`Installing CLI Version '${appc.cli}'`);
		try {
			output.debug('Fetching CLI version from the production environment');
			await exec(`appc use ${appc.cli}`, {
				stdio: [ 0 ]
			});
		} catch (err) {
			if (err.toString().includes(`The version specified ${appc.cli} was not found`)) {
				// Go to the pre-production environment
				output.debug('Couldn\'t find the requested CLI version in production, switching to pre-production');
				await this.login(appc, 'preproduction');

				// Check if the CLI version we want to use is installed
				output.debug(`Checking if the latest version of ${appc.cli} is installed`);
				const
					clis = JSON.parse(await exec('appc use -o json --prerelease')),
					latest = clis.versions.find(element => element.includes(appc.cli)),
					installed = clis.installed.includes(latest);

				if (!latest) {
					throw (new Error(`No Version Found For CLI ${appc.cli}`));
				}

				// If not, install it and set it as default
				if (installed) {
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
	}

	/**
	 * Build a specified application for a given platform. Also allows users to
	 * specify their own arguments.
	 *
	 * @param {String} dir - The path to the application root
	 * @param {String} platform - The mobile OS the app is being built for
	 * @param {Object} opts - Optional arguments
	 * @param {String[]} opts.args - Any additional arguments to be passed to the command
	 * @param {Boolean} opts.ti - Whether or not to use the titanium CLI
	 */
	static build(dir, platform, sdk, { args = [], ti = false } = {}) {
		return new Promise((resolve, reject) => {
			// Validate the arguments are valid
			if (args && !Array.isArray(args)) {
				return reject(Error('Arguments must be an array'));
			}

			// Generate a path to the tiapp.xml file
			const tiappFile = path.join(dir, 'tiapp.xml');

			// Prepare the tiapp.xml before build
			const
				tiapp = require('tiapp.xml').load(tiappFile),
				appName = tiapp.name;

			output.debug(`Building app '${appName}'`);
			output.debug(`Setting tiapp.xml SDK to ${sdk}`);

			// Write the desired SDK to the tiapp.xml
			tiapp.sdkVersion = sdk;

			tiapp.write();

			// Create our default arguments
			let
				cmd,
				cmdArgs;

			if (ti) {
				cmd = 'ti';
				cmdArgs = [ 'build', '-f', '-d', dir, '-p', platform, '--no-prompt', '--build-only' ];
			} else {
				cmd = 'appc';
				cmdArgs = [ 'run', '-f', '-d', dir, '-p', platform, '--no-prompt', '--build-only' ];
			}

			// Add any user defined arguments into the command
			if (args) {
				cmdArgs = cmdArgs.concat(args);
			}

			// Build a command string to display to the console
			let argstring = cmd;

			cmdArgs.forEach(arg => {
				argstring = `${argstring} ${arg}`;
			});

			output.debug(`Invoking command: ${argstring}`);

			// Execute the run command, and listen for events
			const prc = spawn(cmd, cmdArgs, { shell: true });

			prc.stdout.on('data', data => {
				output.debug(data.toString());
			});

			prc.stderr.on('data', data => {
				output.debug(data.toString());
				// Appc CLI doesn't always provide an error code on fail, so need to monitor the output and look for issues manually
				// If statement is there so that [WARN] flags are ignored on stderr
				if (data.toString().includes('[ERROR]')) {
					prc.kill();
					return reject(Error(data.toString().replace(/\W*\[ERROR\]\W*/, '')));
				}
			});

			prc.on('exit', code => {
				(code === 0) ? resolve(this.createAppPath(dir, platform, appName)) : reject(Error('Failed on application build'));
			});
		});
	}

	/**
	 * Generate a path to the built application based upon platform
	 *
	 * @param {String} dir - The path to the root of the application project
	 * @param {String} platform - The relevant mobile OS
	 * @param {String} appName - The name of the app to identify the app package
	 */
	static createAppPath(dir, platform, appName) {
		switch (platform) {
			case 'ios':
				try {
					const
						products = path.join(dir, 'build', 'iphone', 'build', 'Products'),
						productDir = fs.readdirSync(products)[0],
						appPath = path.join(products, productDir, `${appName}.app`);

					return appPath;
				} catch (err) {
					throw Error(`Issue scanning for app package: ${err}`);
				}

			case 'android':
				const sdk = require('tiapp.xml').load(path.join(dir, 'tiapp.xml')).sdkVersion;

				if (sdk[0] >= 9) {
					return path.join(dir, 'build', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
				} else {
					return path.join(dir, 'build', 'android', 'bin', `${appName}.apk`);
				}

			case 'windows':
				return path.join(dir); // FIXME: Find Windows path

			default:
				throw Error('Invalid platform passed to function');
		}
	}

	/**
	 * Build a specified application for a given platform. Also allows users to
	 * specify their own arguments
	 *
	 * @param {String} args - Arguments to be run after calling appc
	 * @param {Object} opts - Optional arguments
	 * @param {function} opts.matcher - A function that can be used to resolve
	 * @param {Boolean} opts.ti - Whether or not to use the titanium CLI
	 * @param {String} opts.proc - Custom name for the global, if empty no global will be created
	 */
	static runner(args, { matcher = undefined, ti = false, proc = undefined } = {}) {
		return new Promise((resolve, reject) => {

			let cmd;

			if (ti) {
				cmd = 'ti';
			} else {
				cmd = 'appc';
			}

			// Build a command string to display to the console
			let argstring = cmd;

			args.forEach(arg => {
				argstring = `${argstring} ${arg}`;
			});

			output.debug(`Invoking command: ${argstring}`);

			const prc = spawn(cmd, args, { shell: true });

			// If this is going to be a persisting process, assign it a custom global
			if (proc) { global[proc] = prc; }

			prc.stdout.on('data', data => {
				output.debug(data.toString());

				if ((typeof matcher) === 'function' && matcher(data.toString())) {
					return resolve();
				}
			});

			prc.stderr.on('data', data => {
				output.debug(data.toString());
				// Appc CLI doesn't always provide an error code on fail, so need to monitor the output and look for issues manually
				// If statement is there so that [WARN] flags are ignored on stderr
				if (data.toString().includes('[ERROR]')) {
					output.debug(data.toString().replace(/\W*\[ERROR\]\W*/, ''));
				}
			});

			prc.on('exit', code => {
				if (proc) { delete global[proc]; }

				(code === 0) ? resolve() : reject(Error(`Command exited with code: ${code}`));
			});
		});
	}
}

module.exports = Appc_Helper;
