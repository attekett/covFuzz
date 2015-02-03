var fse=require('fs-extra')
module.exports={
	type:'spawn',
	debug:false,
	binaries:['.*'],
	target:'chrome',
	tempDirectory:'/run/shm/tmp/',
	resultDirectory:process.env.HOME+'/results/',
	fileExtension:(process.argv.indexOf('-f')+1 && process.argv[process.argv.indexOf('-f')+1]) || 'svg',
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',
	targetBin:process.env.HOME+'/Downloads/chrome/chrome',
	preArgs:['--user-data-dir=/run/shm/tmp/profs/','--no-sandbox','--incognito','--new-window','--no-default-browser-check','--allow-file-access-from-files', '--no-first-run' ,'--no-process-singleton-dialog'],
	maxBlockCount:1,
	sleepTimeout:500,
	killTimeout:10000,
	generateFile:function(file,number){
		fse.removeSync('/run/shm/tmp/profs/'+number)
		this.preArgs[0]=this.preArgs[0]+number
		return file
	}
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]