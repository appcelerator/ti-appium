# ti-appium
The beginning of an npm module to tie together Titanium and Appium functionality. Now that Appium usage is expanding, we're currently maintaining similar source code across different test suites, some fixes are only implemented in certain suites due to lack of maintenance. Once completed this module will be used as a backbone across all our tests.

Currently under construction 🏗

## Usage
As this isn't currently published to npm you'll need to do the following steps.

- `git clone git@github.com:appcelerator/ti-appium.git`
- `cd ti-appium`
- `npm install`
- `npm link`

Once this has been done, you can go to the location you want to use the module, and run `npm link ti-appium`.

## Current Appium Efforts
- [Phoenix](https://github.com/appcelerator/phoenix)
- [Yeti](https://github.com/appcelerator/yeti)
- [KitchenSink v2](https://github.com/appcelerator/qe-kitchensink)
- [SDK Client Generator](https://github.com/appcelerator/Client-Generator-Appium)
- [ACA](https://github.com/longton95/ACA_appium)