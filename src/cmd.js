var fs=require('fs')
var path=require('path')

/*
	Default configuration:

*/
var config={
	analyzeCoverage:true, //Disable if you want to fuzz target without coverage analysis.
	analyzeOnly:false, //Enable to only analyse sample from inputDirectory and exit without fuzzing
	binaries:[".*"], //Array of library/binary names from which you want to collect coverate-data from. used in: new RegExp("("+config.binaries.join('|')+").*\.sancov$")
	debug: false, //Set to enable debugging.
	env:{ //env that is passed to the spawned target. __workDir__ will be replaced with current workDir for each spawned instance
	ASAN_OPTIONS:'detect_leaks=0,coverage=1,coverage_dir=__workDir__' //Default ASAN_OPTIONS. NOTE: Do not remove "coverage_dir=__workDir__" 
	},
	inputDirectory:undefined, //Directory where samples are read on start. 
	instanceCount:1,//How many parallel instances of the target should be executed.
	instrumentationPath:'./src/ASAN.js',//Location for the instrumentation file to be used.
	killSignal:'SIGTERM',//Signal that is used with spawn.kill on timeout
	killTimeout:10000, //Timeout which after the target is killed.
	logging:true, //Logging to file. 
	maxBlockCount:1, //How many files per block are collected from the original sample collection. Doesn't effect during fuzzing phase.
	maxTempTestCases:20, //How many fuzzed test cases we are trying to keep on queue at all times.
	maxTestCaseCount:undefined, //Use this if you want to run specific number of test cases. Note that initial samples count to this limit.
	outputDirectory:undefined, //Directory where samples and test cases that give new coverage are written
	resultDirectory:undefined, //Directory where crashes are outputted
	reverse:false, //Normal mode sorts files from smallest to largest, setting this reverses the order.
	//sleepTimeout:100,
	tempDirectory:undefined //Directory where temps are written. I recommend using a directory that is located on a ramdisk.
}

if(process.argv.length<=2){
	console.log('covFuzz v0.1 - Author: Atte Kettunen (@attekett)')
	console.log('Usage: node covFuzz.js -c <path-to-configuration-file> [Flags]')
	console.log('For more info about configuration files, check examples.')
	console.log('Flags:')
	console.log('  --debug 	-	Enable debug.')
	console.log('  -d <path>	-	Input sample directory.')
	console.log('  -o <path>	-	Output directory for samples.')
	console.log('  -i <int>	-	Amount of parallel instances.')
	console.log('  -a		-	Only analyse the input samples and exit.')
	console.log('  -max <int> 	-	Specify amount of files to run and exit.')
	process.exit()
}


function pargv(flag){
	return process.argv.indexOf(flag)+1
}

function getargv(flag){
	return process.argv[pargv(flag)]
}

if(!pargv('-c')){
	console.log('No config-file');
	process.exit(0)
}
else{
	var configName=path.basename(getargv('-c'),'.js')
	config.configName=configName
	var configPath=path.resolve(getargv('-c'))
	if(fs.existsSync(configPath)){
		console.log('Reading configuration file: '+configPath)
		var user_config=require(configPath)
	}
	else{
		console.log('Defined config-file: '+configPath+' does not exist.')
		process.exit(0)
	}

}

if(user_config !== undefined){
	for(var key in user_config)
		config[key]=user_config[key]
}

var cmd_config={
	debug:pargv('--debug') && true || undefined,
	inputDirectory:(pargv('-d') && getargv('-d')) || undefined,
	outputDirectory:(pargv('-o') && getargv('-o')) || undefined,
	instanceCount:(pargv('-i') && getargv('-i')) || undefined,
	analyzeOnly:pargv('-a') && true || undefined,
	maxTestCaseCount:(pargv('-max') && getargv('-max')) || undefined,
}

for(var key in cmd_config){
	if(cmd_config[key])
		config[key]=cmd_config[key]
}

if(config.outputDirectory){
	if(!fs.existsSync(config.outputDirectory))
		fs.mkdirSync(config.outputDirectory)
	}
else{
	config.outputDirectory=config.inputDirectory
}
if(!fs.existsSync(config.tempDirectory))
	fs.mkdirSync(config.tempDirectory)

if(!fs.existsSync(config.tempDirectory+'/samples/'))
	fs.mkdirSync(config.tempDirectory+'/samples/')
else
	fs.readdirSync(config.tempDirectory+'/samples/').map(function(fileName){return path.resolve(config.tempDirectory+'/samples/',fileName)}).map(function(fileName){fs.unlinkSync(fileName)})

config.commandLine=config.commandLine.split(' ')
config.targetBin=config.commandLine.splice(0,1)[0]

if(!fs.existsSync(config.targetBin)){
	console.log('Target: '+config.targetBin+' does not exist.')
	process.exit()
}

if(config.binaries){
	config.fileNameRegExp=new RegExp("("+config.binaries.join('|')+").*\.sancov$")
}

console.log('Configuration:')
console.log(config)

if(config.debug)
	console.dlog=function(msg,type){
		type=type||'Debug'
		console.log('['+(new Date().getTime())+']['+type+']'+msg)
	}
else
	console.dlog=function(){}

if(config.logging){
	var logFile=fs.createWriteStream(path.resolve(config.resultDirectory,config.configName+'-covFuzz.log'))
	console.fileLog=function(msg,type){
		if(type)
			logFile.write('['+new Date()+']['+type+'] '+msg)
		else
			logFile.write('['+new Date()+'] '+msg)
	}
}
else
	console.fileLog=function(){}


process.on('SIGINT',function(){
	logFile.end()
})

process.on('exit',function(){
	logFile.end()
})

if(!config.hasOwnProperty('configureCommandline')){
	config.configureCommandline=function(file,workDir,environment){
		var commandLine=[]
		for(var x=0; x<config.commandLine.length;x++){
			commandLine.push(config.commandLine[x].replace('@@',file).replace('##',workDir))
		}
		return commandLine
	}.bind(config)
}
else
	config.configureCommandline.bind(config)

console.dlog('Configuration done.')

module.exports=config