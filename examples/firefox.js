var fse=require('fs-extra')
module.exports={
	debug:false,
	target:'firefox',
	killSignal:'SIGSEGV',
	tempDirectory:'/run/shm/tmp/',
	resultDirectory:process.env.HOME+'/results/',
	fileExtension:(process.argv.indexOf('-f')+1 && process.argv[process.argv.indexOf('-f')+1]) || 'svg',
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',
	commandline:process.env.HOME+'/firefox/objdir-ff-asan/dist/bin/firefox -no-remote -private-window @@',
	maxBlockCount:1,
	sleepTimeout:500,
	killTimeout:20000,
	generateFile:function(file,number){
		fse.removeSync('/run/shm/tmp/'+number+'/moz')
		fse.mkdirSync('/run/shm/tmp/'+number+'/moz')

		this.preArgs[0]=this.preArgs[0]+number
		return file
	}
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]