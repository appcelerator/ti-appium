#!groovy
library 'pipeline-library'

buildNPMPackage {
	labels = '(osx || linux) && git && npm-publish'
	npmVersion = 'latest-6' // pin to 6.X to workaround https://github.com/npm/cli/issues/2834
}
