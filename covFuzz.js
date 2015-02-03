
var fs=require('fs')
var path=require('path')
var spawn=require('child_process').spawn
var exec=require('child_process').exec
var crypto=require('crypto')
var events = require('events');
var statusEmitter = new events.EventEmitter();


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
	postArgs:[],
	preArgs:[],
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


console.log('Configuration:')
console.log(config)

console.log('ldd target:')

require('child_process').exec('ldd '+config.targetBin,function(err,stdout,stderr){
	if(err)
		console.log(stderr)
	console.log(stdout)
})

if(config.binaries){
	var fileNameRegExp=new RegExp("("+config.binaries.join('|')+").*\.sancov$")
}


var processKill=function(){}
var processKillTimeout={}
var mutex=false
if(config.kill){
	if(Array.isArray(config.kill))
		var processNames=config.kill
	else
		var processNames=config.kill.split(',')
	var killCommand=''
	for(var x=0; x<processNames.length; x++)
					killCommand+='pkill -9 '+processNames[x]+'; '	
	processKill=function(num){
		if(!mutex){
			mutex=true
			clearTimeout(processKillTimeout)
			processKillTimeout=setTimeout(function(){
				clearTimeout(processKillTimeout)
				statusEmitter.emit('kill')
				exec(killCommand,function(err,stdout,stderr){
					console.log('Timeout kill.')
				})
				clearTimeout(processKillTimeout)
			},config.killTimeout)
			mutex=false
		}	
	}
}

if(config.debug)
	var log=function(msg){console.log('['+(new Date().getTime())+'][Debug]'+msg)}
else
	var log=function(){}


var files=fs.readdirSync(config.inputDirectory).map(function(fileName){if(!fs.statSync(path.resolve(config.inputDirectory,fileName)).isDirectory()){return path.resolve(config.inputDirectory,fileName)}else{return undefined}});
files=files.filter(function(file){if(file){return file}else{return false}})
if(files.length>200000)
	files.length=200000


files.sort(function(a,b){
	return fs.statSync(path.resolve(config.inputDirectory,b)).size-fs.statSync(path.resolve(config.inputDirectory,a)).size
})

if(config.fastForward)
	files.splice(0,config.fastForward)

log('Files:')
log(files)

if(!config.hasOwnProperty('generateFile'))
	config.generateFile=function(file){log('File: '+file); return file}


var logFile=fs.createWriteStream(path.resolve(config.resultDirectory,configName+'-covFuzz.log'))


var currentCoverage={}
var totalBlocks=0;
var fileList=[]
var fails=[]
var totalFiles=0;
var noBlocks=0;

var returns=1
var maxBlockCount=config.maxBlockCount
config.unlink=false;
function generateNewFiles(number){
	clearTimeout(processKillTimeout)
	var sampleFiles=fs.readdirSync(config.tempDirectory+'/samples/').map(function(fileName){return path.resolve(config.tempDirectory+'/samples/',fileName)});
	console.log('['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' Corpus size: '+fileList.length+ ' TotalBlocks: '+totalBlocks)	
	if(sampleFiles.length<1){
		console.log('No new blocks this round. Using fresh samples.')
		maxBlockCount=config.maxBlockCount
		sampleFiles=fs.readdirSync(config.outputDirectory).map(function(fileName){return path.resolve(config.outputDirectory,fileName)});
	}
	else{
		maxBlockCount=1;
		console.log('Found new blocks this round. Using those '+sampleFiles.length+' files as samples.')
	}
	if(Array.isArray(config.generatorFunction)){
		ra(config.generatorFunction)(sampleFiles,startNewGeneration)
	}
	else{
		config.generatorFunction(sampleFiles,startNewGeneration)
	}
}

function startNewGeneration(err,stdout,stderr){
	err && console.log(err)
	stderr && console.log(stderr)

	files=fs.readdirSync(config.tempDirectory+'/samples/').map(function(fileName){return path.resolve(config.tempDirectory+'/samples/',fileName)});
	for(var x=0; x<config.instanceCount; x++)
		continueRound(x)
}

function asanFingerPrint(stderr){
	if(stderr && stderr.indexOf('ERROR: AddressSanitizer') !=-1){
		asanTrace=stderr.replace('\n','').replace(/\s+/g,' ').split(' ')
		var fingerPrint=""
		var frame=""
		if(asanTrace.indexOf('AddressSanitizer:')!=-1){
			fingerPrint+=asanTrace[asanTrace.indexOf('AddressSanitizer:')+1]
		}
		if(fingerPrint=="stack-overflow")
			return fingerPrint
		asanTrace.splice(0,asanTrace.indexOf('AddressSanitizer:'))
		if(asanTrace.indexOf('#0')!=-1){
			frame=asanTrace[asanTrace.indexOf('#0')+1]
			fingerPrint+="-"+frame.substr(frame.length-3,3)
		}
		if(asanTrace.indexOf('#1')!=-1){
			frame=asanTrace[asanTrace.indexOf('#1')+1]
			fingerPrint+="-"+frame.substr(frame.length-3,3)
		}
		if(asanTrace.indexOf('#2')!=-1){
			frame=asanTrace[asanTrace.indexOf('#2')+1]
			fingerPrint+="-"+frame.substr(frame.length-3,3)
		}

		if(fingerPrint=="")
			return null
		else{
			return fingerPrint
		}
	}
	else{
		return null
	}
}


function unpackSancovPacked(file){
	var cf=fs.readFileSync(file)
	var x=0
	var unpackedSancov={}

	log('Packed sancov name: '+file)
	log('Packed sancov length: '+cf.length)
	if(cf.length>12){
		while(true){
			var header=[cf.readInt32LE(x),cf.readInt32LE(x+4),cf.readInt32LE(x+8)]
			var module=cf.slice(x+12,x+12+header[1]).toString().split('.')[0]
			var data=cf.slice(x+12+header[1],x+12+header[1]+header[2])
			if(unpackedSancov[module]){
				unpackedSancov[module]=Buffer.concat([unpackedSancov[module],data])
			}else {
				unpackedSancov[module]=data
			}
			x=x+12+header[1]+header[2]
			log('X after unpacking '+module+': '+x)
			if(x>=cf.length){
				break;
			}
		}
	}
	else{
		log('Pack length under header length.')
	}
	return unpackedSancov
}


var banner=false
var bitsetMode=true
function getCoverageData(number){
	var coverageData={}
	var covFiles=fs.readdirSync(config.tempDirectory+'/'+number)
	for(var x=0; x<covFiles.length; x++){
		if(fileNameRegExp.test(covFiles[x])){
			log('Regular sancov. '+covFiles[x])
			var module=covFiles[x].split('.')[0]
			if(coverageData[module]){
					log('Found previous entry.')
					log('Previous entry size: '+coverageData[module].length)
					coverageData[module]=Buffer.concat([coverageData[module],fs.readFileSync(config.tempDirectory+'/'+number+'/'+covFiles[x])])
					log('New entry size: '+coverageData[module].length)
					
			}else{
				coverageData[module]=fs.readFileSync(config.tempDirectory+'/'+number+'/'+covFiles[x])
			}
		}else if(config.readPacked && covFiles[x].indexOf('.sancov.packed')!=-1){
			log('Packed sancov!')
			log('Disabling bitset-mode.')
			bitsetMode=false
			var unpackedSancov=unpackSancovPacked(config.tempDirectory+'/'+number+'/'+covFiles[x])
			log('Unpacked:')
			log(unpackedSancov)
			for(var y in unpackedSancov){
				log('Checking for '+ y)
				if(coverageData[y]){
					console.log('Found '+y+' from packed file')
					log('Found previous entry.')
					log('Previous entry size: '+coverageData[y].length)
					coverageData[y]=Buffer.concat([coverageData[y],unpackedSancov[y]])
					log('New entry size: '+coverageData[y].length)
					
				}else if(!config.binaries || config.binaries.indexOf(y)!=-1){
					console.log('Found '+y+' from packed file')
					coverageData[y]=unpackedSancov[y]
				}
			}
		}
	}
	return coverageData
}



function isKeeper(coverageData){
	var keeper=0;	
	if(bitsetMode && coverageData.combined){
		if(!currentCoverage.combined){
			console.log('Initialising new bitset coverage buffer.')
			currentCoverage.combined=new Buffer(coverageData.combined.length)
			currentCoverage.combined.fill(0)
		}
		if(currentCoverage.combined.length==coverageData.combined.length){
			var covLength=currentCoverage.combined.length
			var newCovLength=coverageData.combined.length
			for(var x=0; x<covLength;x++){
				if(x>newCovLength)
					break;
				if(coverageData.combined[x]!=0x30){
					if(currentCoverage.combined[x]==0){
						keeper++;
						totalBlocks++
						currentCoverage.combined[x]=1
					}else if(currentCoverage.combined[x]<maxBlockCount){
						keeper++;
						currentCoverage.combined[x]++
					}
				}
			}
		}
		else{
			console.log('Initial bitset file length differs from current.(Binary loads libraries middle of the run.)')
			console.log('Original bitset file length: '+currentCoverage.combined.length)
			console.log('Current bitset file length: '+coverageData.combined.length)
			console.log('Bailing out from bitset mode.')
			console.log('Note: Alternative method uses offset file per library/binary and is a lot slower. Also all coverage data is reset.')
			totalBlocks=0;
			bitsetMode=false
		}
	}
	else{
		for(var x in coverageData){
			if(x!='combined'){
				if(!currentCoverage[x]){
					console.log('Collecting coverage for: '+x)
					currentCoverage[x]=[]
				}
				var len=coverageData[x].length
				var i=0;
				var result=[]
				while(i<len){
					var offset=coverageData[x].readUInt32LE(i)
					if(currentCoverage[x][offset]===undefined){
						keeper++;
						totalBlocks++
						currentCoverage[x][offset]=1
					}else if(currentCoverage[x][offset]<maxBlockCount){
						keeper++;
						currentCoverage[x][offset]++
					}
					i+=4
				}
			}
		}
	}
	return keeper
}

function endRound(number){
	if(returns==config.instanceCount){
		returns=1
		if(!config.disableLogging){
			var status='['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' Corpus size: '+fileList.length+ ' TotalBlocks: '+totalBlocks+'\n'
			logFile.write(status)
		}
		if(totalFiles>=config.maxTestCaseCount || config.analyzeOnly)
			process.exit(1)
		else
			config.unlink=true;
		generateNewFiles(number)
	}
	else{
		returns++
	}
}

function saveNewSamples(files,newBlocks){
	console.log('['+(new Date().getTime())+']File(s): '+files.join(' ')+' newblocks:'+newBlocks+' corpussize: '+fileList.length+' totalblocks: '+totalBlocks)							
	files.forEach(function(file){
		fileList.push(file)
		var fileContent=fs.readFileSync(file)
		var fileName=crypto.createHash('sha1').update(fileContent).digest('hex')
		if(file.indexOf(config.outputDirectory)==-1)
			fs.writeFileSync(path.resolve(config.outputDirectory,path.basename(fileName)+'.'+config.fileExtension),fileContent)
	})
}

function unlinkFiles(files){
	files.forEach(function(file){
		fs.unlinkSync(file)
	})
}

function onTargetExit(stderr,files,number,killed){
	
	if(!killed){
		var fingerPrint=asanFingerPrint(stderr)
		if(fingerPrint !== null){
			if(fingerPrint && fingerPrint!="stack-overflow"){	
				if(!fs.existsSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint,config.target+'-'+fingerPrint+'.txt'))){
					console.log(stderr)	
					console.log('Repro-file saved to: '+path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.'+config.fileExtension))
					fs.mkdirSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint))
					files.forEach(function(file,index){	
						fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint,config.target+'-'+fingerPrint+index+'.'+config.fileExtension),fs.readFileSync(file))
						fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint,config.target+'-'+fingerPrint+'.txt'),stderr)
					})
				}
				else{
					console.log('Dupe: '+path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.'+config.fileExtension))
				}
			}
			if(config.unlink)
				unlinkFiles(files)
		}
		else if(config.analyzeCoverage){
			var coverageData=getCoverageData(number)
			var currentBlocks=totalBlocks;
			if(isKeeper(coverageData)){
				var newBlocks=totalBlocks-currentBlocks
				saveNewSamples(files,newBlocks)
			}
			else{
	            noBlocks++;		
	         	if(config.unlink || config.optimize){
	            	unlinkFiles(files)
				}
		    }
		}
	}
	else{
		unlinkFiles(files)
	}
	continueRound(number)
}

function spawnCoverage(number){
	this.fs=fs
	if(files.length>0 && totalFiles!=config.maxTestCaseCount){
		fs.readdirSync(config.tempDirectory+'/'+number).map(function(fileName){if(!fs.statSync(path.resolve(config.tempDirectory+'/'+number,fileName)).isDirectory()){fs.unlinkSync(path.resolve(config.tempDirectory+'/'+number,fileName));}})		
		if(!config.batchMode){
			var file=[files.pop()]
		}
		else{
			var file=files.splice(0,10)
		}
		if(files.length>1000 && files.length%100==0)
			console.log('['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' Corpus size: '+fileList.length+ ' TotalBlocks: '+totalBlocks)
		/*if(!fs.existsSync(file))
			continueRound(number)
		else{*/
			totalFiles+=file.length
			var environment=Object.create(process.env)	
			environment.HOME=config.tempDirectory+'/'+number+'/moz/'		
			if(config.ASAN_OPTIONS){
				environment.ASAN_OPTIONS=config.ASAN_OPTIONS+config.tempDirectory+'/'+number
			}
			this.preArgs=[]
			for(var x=0; x<config.preArgs.length;x++)
				this.preArgs[x]=config.preArgs[x]
			var target=spawn(config.targetBin,this.preArgs.concat(config.generateFile.call(this,file,number)).concat(config.postArgs),{env:environment})
			var stderr=""
			var stdout=""
			var killed=false
			var statusCount=0;
			var killObserver=function(){
				killed=true
			}
			statusEmitter.on('kill',killObserver)
			var stateObserver=setInterval(function(){
				if(fs.existsSync('/proc/'+target.pid+'/stat')){
					var status=fs.readFileSync('/proc/'+target.pid+'/stat').toString().split(' ')[2]
					if(status!='R' && status!='D'){
						statusCount++;
						log('/proc/'+target.pid+'/stat Status: '+status)
						if(statusCount>2){
							clearInterval(stateObserver)
							target.stderr.removeAllListeners('data')
							target.kill(config.killSignal)
						}
					}else{
						statusCount=0;
					}
				}else{
					console.log('No stat file.')
					clearInterval(stateObserver)
					target.stderr.removeAllListeners('data')
					target.kill(config.killSignal)
				}
			},config.sleepTimeout/2)
			target.stderr.on('data',function(data){
				log(data.toString())
				if(stderr!="" || data.toString().indexOf('ERROR: AddressSanitizer')!=-1){
					var newData=data.toString()
					stderr+=newData
					if(newData.indexOf('=='+target.pid+'==ABORTING')!=-1){
						log('ASAN-trace ended.')
						target.kill('SIGKILL')
					}
				}
			})
			target.on('close',function(code){
				clearInterval(stateObserver)
				statusEmitter.removeListener('kill', killObserver);
				onTargetExit(stderr,file,number,killed)
			})
		//}
		processKill()	
	}
	else{
		endRound(number)
	}
}

function execCoverage(number){
	this.fs=fs
	if(files.length>0 && totalFiles!=config.maxTestCaseCount){
		fs.readdirSync(config.tempDirectory+'/'+number).map(function(fileName){if(!fs.statSync(path.resolve(config.tempDirectory+'/'+number,fileName)).isDirectory()){fs.unlinkSync(path.resolve(config.tempDirectory+'/'+number,fileName));}})		
		if(!config.batchMode){
			var file=[files.pop()]
		}
		else{
			var file=files.splice(0,10)
		}
		//console.log(file)
		if(files.length>1000 && files.length%100==0)
			console.log('['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' Corpus size: '+fileList.length+ ' TotalBlocks: '+totalBlocks)
		/*if(!fs.existsSync(file))
			continueRound(number)
		else{*/
			totalFiles++
			var environment=Object.create(process.env)			
			if(config.ASAN_OPTIONS){
				environment.ASAN_OPTIONS=config.ASAN_OPTIONS+config.tempDirectory+'/'+number
			}
			var killed=false
			var killObserver=function(){
				killed=true
			}
			statusEmitter.on('kill',killObserver)
			//console.log(config.targetBin+' '+config.preArgs.concat(config.generateFile.call(this,file,number)).concat(config.postArgs).join(' '))
			exec(config.targetBin+' '+config.preArgs.concat(config.generateFile.call(this,file,number)).concat(config.postArgs).join(' '),{env:environment},function(err,stdout,stderr){
				log('stdout:\n'+stdout.toString())
				log('stderr:\n'+stderr.toString())
				statusEmitter.removeListener('kill', killObserver);
				onTargetExit(stderr,file,number,killed)
			})
		//}
		processKill()	
	}
	else{
		endRound(number)
	}
}

function ra(array){
	return array[Math.floor(Math.random()*array.length)]
}

if(config.type){
	if(config.type=='exec')
		continueRound=execCoverage
	else if(config.type=='spawn')
		continueRound=spawnCoverage
	else{
		console.log('Invalid type in configuration. Set config.type to "spawn" or "exec".')
	}
}
else{
	console.log('No type defined. set config.type to "spawn" or "exec".')
}

for(var x=0; x<config.instanceCount; x++){
	if(!fs.existsSync(config.tempDirectory+'/'+x))
		fs.mkdirSync(config.tempDirectory+'/'+x);
	continueRound(x)
}


