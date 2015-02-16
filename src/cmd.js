var fs=require('fs')
var path=require('path')

var config={
	type:'exec',
	analyzeOnly:false,
	analyzeCoverage:true,
	ASAN_OPTIONS:'detect_leaks=0,coverage_bitset=1,coverage=1,coverage_dir=',
	binaries:[".*"],
	debug: false,
	bitsetMode:false,
	disableLogging:false,
	killSignal:'SIGTERM',
	fastForward:undefined,
	fileExtension:undefined,
	filesPerRound:100,
	inputDirectory:undefined,
	instanceCount:1,
	kill:undefined,
	killOnStatus:true,
	killTimeout:10000,
	maxBlockCount:1,
	maxTestCaseCount:undefined,
	optimize:false,
	outputDirectory:undefined,
	resultDirectory:undefined,
	sleepTimeout:100,
	tempDirectory:undefined,
	generatorFunction:function (sampleFiles,callback){
		if(!this.surku){
			var surkuConfig={
				maxMutations:20,
				minMutations:1,
				chunkSize:3000,
			}
			var S=require('surku');
			this.surku=new S(surkuConfig)
		}
		var fileCount=this.filesPerRound
		var prefix=new Date().getTime()

		while(fileCount--){
			fs.writeFileSync(this.tempDirectory+'/samples/'+prefix+fileCount+'.'+this.fileExtension,this.surku.generateTestCase(fs.readFileSync(sampleFiles[Math.floor(Math.random()*sampleFiles.length)])))
		}
		callback()
	}
}

if(process.argv.indexOf('-c')==-1){
	console.log('No config-file');
	process.exit(0)
}
else{
	var configName=path.basename(process.argv[process.argv.indexOf('-c')+1],'.js')
	config.configName=configName
	if(fs.existsSync(path.resolve(process.argv[process.argv.indexOf('-c')+1]))){
		console.log('Reading configuration file: '+path.resolve(process.argv[process.argv.indexOf('-c')+1]))
		var user_config=require(path.resolve(process.argv[process.argv.indexOf('-c')+1]))
	}
	else{
		console.log('Defined config-file: '+path.resolve(process.argv[process.argv.indexOf('-c')+1])+' does not exist.')
		process.exit(0)
	}

}

if(user_config !== undefined){
	for(var key in user_config)
		config[key]=user_config[key]
}

var cmd_config={
	debug:process.argv.indexOf('--debug')+1 && true || undefined,
	inputDirectory:(process.argv.indexOf('-d')+1 && process.argv[process.argv.indexOf('-d')+1]) || undefined,
	outputDirectory:(process.argv.indexOf('-o')+1 && process.argv[process.argv.indexOf('-o')+1]) || undefined,
	instanceCount:(process.argv.indexOf('-i')+1 && process.argv[process.argv.indexOf('-i')+1]) || undefined,
	optimize:process.argv.indexOf('--optimize')+1 && true || undefined,
	kill:(process.argv.indexOf('-kill')+1 && process.argv[process.argv.indexOf('-kill')+1]) || undefined,
	analyzeOnly:process.argv.indexOf('-a')+1 && true || undefined,
	maxTestCaseCount:(process.argv.indexOf('-max')+1 && process.argv[process.argv.indexOf('-max')+1]) || undefined,
}

for(var key in cmd_config){
	if(cmd_config[key])
		config[key]=cmd_config[key]
}

if(Array.isArray(config.generatorFunction)){
	for(var x in config.generatorFunction){
		config.generatorFunction[x]=config.generatorFunction[x].bind(config)
	}
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
if(config.binaries){
	config.fileNameRegExp=new RegExp("("+config.binaries.join('|')+").*\.sancov$")
}

console.log('Configuration:')
console.log(config)

console.log('ldd target:')
require('child_process').exec('ldd '+config.targetBin,function(err,stdout,stderr){
	if(err)
		console.log(stderr)
	console.log(stdout)
})

if(config.debug)
	console.dlog=function(msg){console.log('['+(new Date().getTime())+'][Debug]'+msg)}
else
	console.dlog=function(){}

if(!config.hasOwnProperty('configureCommandline')){
	config.configureCommandline=function(file,number,environment){
		var commandLine=[]
		for(var x=0; x<config.commandLine.length;x++){
			commandLine.push(config.commandLine[x].replace('@@',file).replace('##',number))
		}
		return commandLine
	}.bind(config)
}
else
	config.configureCommandline.bind(config)

module.exports=config