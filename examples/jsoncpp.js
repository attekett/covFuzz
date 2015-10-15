

module.exports={
	debug:false,
	fileExtension:'json',
	killTimeout:3000,
	maxBlockCount:1,
	filesPerRound:200,
	inputDirectory:process.env.HOME+'/samples/samples-media-cut/',
	resultDirectory:process.env.HOME+'/results/',
	target:'jsoncpp',
	commandLine:process.env.HOME+'/projects/jsoncpp/build/debug/src/jsontestrunner/jsontestrunner_exe --json-checker @@',
	tempDirectory:'/run/shm/tmp/'
}
