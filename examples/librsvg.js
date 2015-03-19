
module.exports={
	debug:false,
	fileExtension:'svg',
	killTimeout:3000,
	maxBlockCount:5,
	filesPerRound:200,
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',	
	inputDirectory:process.env.HOME+'/samples/samples-svg/',
	resultDirectory:process.env.HOME+'/results/',
	target:'rsvg-convert',
	commandLine:process.env.HOME+'/point-n-click/packages/librsvg/.libs/rsvg-convert @@ -o /dev/null',
	tempDirectory:'/run/shm/tmp/'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
