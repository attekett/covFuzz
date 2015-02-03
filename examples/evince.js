module.exports={
	type:'spawn',
	debug:false,
	target:'evince',
	tempDirectory:'/run/shm/tmp/',
	resultDirectory:'/home/attekett/results/',
	fileExtension:'pdf',
	targetBin:'/home/attekett/point-n-click/packages/evince-3.10.3/bin/evince',
	preArgs:['--sm-client-disable'],
	maxBlockCount:1,
	killTimeout:5000,
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]