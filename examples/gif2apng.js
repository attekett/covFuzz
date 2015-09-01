

module.exports={
	debug:false,
	fileExtension:'gif',
	killTimeout:3000,
	maxBlockCount:5,
	filesPerRound:200,
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',	
	inputDirectory:process.env.HOME+'/samples/samples-gif/',
	resultDirectory:process.env.HOME+'/results/',
	target:'gif2apng',
	commandLine:process.env.HOME+'/Downloads/gif2apng-1.9-src/gif2apng @@ /run/shm/tmp/test.apng',
	tempDirectory:'/run/shm/tmp/'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
