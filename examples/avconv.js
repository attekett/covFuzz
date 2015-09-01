

module.exports={
	debug:false,
	fileExtension:'media',
	killTimeout:3000,
	maxBlockCount:1,
	filesPerRound:200,
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',	
	inputDirectory:process.env.HOME+'/samples/samples-media-cut/',
	resultDirectory:process.env.HOME+'/results/',
	target:'avconv',
	commandLine:process.env.HOME+'/Downloads/libav-0.8.17/avconv -i @@ -f null -',
	tempDirectory:'/run/shm/tmp/'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
