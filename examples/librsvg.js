
module.exports={
	debug:false,
	fileExtension:'svg',
	killTimeout:3000,
	maxBlockCount:1,
	inputDirectory:process.env.HOME+'/samples/samples-svg/',
	postArgs:['-o','/dev/null'],
	resultDirectory:process.env.HOME+'/results/',
	target:'rsvg-convert',
	targetBin:process.env.HOME+'/librsvg/.libs/rsvg-convert ',
	tempDirectory:'/run/shm/tmp/',
	//analyzeCoverage:false,
	//ASAN_OPTIONS:"",
	type:'exec'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
