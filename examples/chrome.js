var fse=require('fs-extra')
module.exports={
	debug:false,
	binaries:['chrome','ffmpeg'],
	target:'chrome',
	tempDirectory:'/run/shm/tmp/',
	resultDirectory:process.env.HOME+'/results/',
	fileExtension:(process.argv.indexOf('-f')+1 && process.argv[process.argv.indexOf('-f')+1]) || 'svg',
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=',
	commandLine:process.env.HOME+'/Downloads/chrome/chrome --user-data-dir=/run/shm/tmp/profs/## --no-sandbox --incognito --new-window --no-default-browser-check --allow-file-access-from-files --no-first-run --no-process-singleton-dialog @@',
	maxBlockCount:1,
	sleepTimeout:500,
	killTimeout:10000,
	configureCommandline:function(file,number,environment){
		var commandLine=[]
		fse.removeSync('/run/shm/tmp/profs/'+number)
		for(var x=0; x<this.commandLine.length;x++){
			commandLine.push(this.commandLine[x].replace('@@',file).replace('##',number))
		}
		return commandLine
	}
}

var testCaseGenerators=require('./testCaseGeneratorFunctions.js')
module.exports.generatorFunction=[testCaseGenerators.radamsa,testCaseGenerators.surku]
