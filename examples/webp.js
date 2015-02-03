
module.exports={
	debug:false,
	fileExtension:'webp',
	killTimeout:3000,
	maxBlockCount:3,
	inputDirectory:process.env.HOME+'/samples/samples-img/',
	postArgs:['-o','/dev/null'],
	resultDirectory:'/home/attekett/results/',
	target:'libwebp',	
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',
	filesPerRound:200,
	targetBin:process.env.HOME+'/libwebp/build/bin/dwebp',
	tempDirectory:'/run/shm/tmp/',
	//analyzeCoverage:false,
	//ASAN_OPTIONS:"",
	type:'exec'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
