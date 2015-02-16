
module.exports={
	debug:false,
	fileExtension:'svg',
	killTimeout:3000,
	maxBlockCount:1,
	inputDirectory:process.env.HOME+'/samples/samples-svg/',
	resultDirectory:process.env.HOME+'/results/',
	preArgs:['-t']
	target:'atomicparsley',
	targetBin:'/home/attekett/projects/atomicparsley-0.9.2~svn110/AtomicParsley ',
	tempDirectory:'/run/shm/tmp/',
	//analyzeCoverage:false,
	//ASAN_OPTIONS:"",
	type:'exec'
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
