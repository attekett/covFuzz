
module.exports={
	tempDirectory:'/run/shm/tmp/',
	resultDirectory:process.env.HOME+'/results/',
	fileExtension:'pdf',
	target:'pdftotext',
	commandLine:process.env.HOME+'/poppler-0.24.5/utils/.libs/lt-pdftotext @@ /dev/null',
	maxBlockCount:1,
	killTimeout:2000,
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')

module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
