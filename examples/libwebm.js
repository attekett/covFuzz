

module.exports={
	debug:false,
	fileExtension:'webm',
	killTimeout:3000,
	maxBlockCount:5,
	filesPerRound:200,
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',	
	inputDirectory:process.env.HOME+'/samples/samples-gif/',
	resultDirectory:process.env.HOME+'/results/',
	target:'libwebm',
	commandLine:process.env.HOME+'/projects/libwebm/sample @@',
	tempDirectory:'/run/shm/tmp/'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
