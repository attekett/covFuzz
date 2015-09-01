

module.exports={
	debug:false,
	fileExtension:'apng',
	killTimeout:3000,
	maxBlockCount:5,
	filesPerRound:200,
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',	
	inputDirectory:process.env.HOME+'/samples/samples-gif/',
	resultDirectory:process.env.HOME+'/results/',
	target:'gif2apng',
	commandLine:process.env.HOME+'/Downloads/apng2gif-1.7-src/apng2gif @@ ../test.png',
	tempDirectory:'/run/shm/tmp/'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
