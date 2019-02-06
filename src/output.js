'use strict';

// Colours to be used in the console logging
const
	Red = '\x1b[31m',
	Grey = '\x1b[37m',
	Reset = '\x1b[0m',
	Green = '\x1b[32m',
	Yellow = '\x1b[33m';

class Output_Helper {
	/*****************************************************************************
	 * Writes a message with a green info tag (note no new line is passed by
	 * default).
	 *
	 * @param {String} message - A string to be output after the info tag
	 ****************************************************************************/
	static step(message) {
		message = `${Green}[INFO]${Reset} ${sanitise(message)}... `;

		if (process.env.logging === 'debug') {
			message = `${message}\n`;
		}

		if (process.env.logging) {
			process.stdout.write(message);
		}
	}

	/*****************************************************************************
	 * Writes a green done to the console and resolves the promise if passed.
	 *
	 * @param {Function} done - Promise callback passed from the function
	 * @param {Object} value - An object to be returned with resolve
	 ****************************************************************************/
	static finish(done, value) {
		if (process.env.logging === 'basic') {
			process.stdout.write(`${Green}Done${Reset}\n`);
		}

		if (done) {
			done(value);
		}
	}

	/*****************************************************************************
	 * Writes a yellow skip to the console and resolves the promise if passed.
	 *
	 * @param {Function} done - Promise callback passed from the function
	 * @param {Object} value - An object to be returned with resolve
	 ****************************************************************************/
	static skip(done, value) {
		if (process.env.logging === 'basic') {
			process.stdout.write(`${Yellow}Skipping${Reset}\n`);
		}

		if (done) {
			done(value);
		}
	}

	/*****************************************************************************
	 * Writes a message with a green info tag (note no new line is passed by
	 * default).
	 *
	 * @param {String} message - A string to be output after the info tag
	 ****************************************************************************/
	static info(message) {

		message = `${Green}[INFO]${Reset} ${sanitise(message)}\n`;

		if (process.env.logging) {
			process.stdout.write(message);
		}
	}

	/*****************************************************************************
	 * Outputs all of a string in red.
	 *
	 * @param {String} message - String to be output
	 ****************************************************************************/
	static error(message) {
		message = `${Red}[ERROR] ${sanitise(message)}${Reset}\n`;

		if (process.env.logging === 'basic') {
			message = `\n${message}`;
		}

		if (process.env.logging) {
			process.stdout.write(message);
		}
	}

	/*****************************************************************************
	 * Creates a banner and a green info tag around a message.
	 *
	 * @param {String} message - String to be enclosed by the banner
	 ****************************************************************************/
	static banner(message) {
		if (process.env.logging) {
			process.stdout.write('\n-------------------------------------------------------\n');
			process.stdout.write(`${Green}[INFO]${Reset} ${message}\n`);
			process.stdout.write('-------------------------------------------------------\n');
		}
	}

	/*****************************************************************************
	 * Outputs a message when the debug flag is used.
	 *
	 * @param {String} message - String to be output
	 ****************************************************************************/
	static debug(message) {
		message = `${Grey}[DEBUG] ${sanitise(message)}${Reset}\n`;

		if (process.env.logging === 'debug') {
			process.stdout.write(message);
		}
	}
}

/*****************************************************************************
 * Take the message, and make sure it is fit for use.
 *
 * @param {String} message - String to be output
 ****************************************************************************/
function sanitise(message) {
	if (message instanceof Error) {
		return message.toString('utf8');
	} else if (message instanceof Object) {
		if (message instanceof Buffer) {
			return message.toString('utf8');
		} else {
			return JSON.stringify(message, null, 2);
		}
	} else {
		while (message.endsWith('\n')) {
			message = message.substring(0, message.length - 1);
		}

		return message;
	}
}

module.exports = Output_Helper;
