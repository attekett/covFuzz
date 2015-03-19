#!/usr/bin/env node

var fs=require('fs')
var path=require('path')
var crypto=require('crypto')

var config=require('./src/cmd.js')
var ASAN=require('./src/ASAN.js')
ASAN.getCoverageData=ASAN.getCoverageData.bind(config)

var files=fs.readdirSync(config.inputDirectory).map(function(fileName){
	if(!fs.statSync(path.resolve(config.inputDirectory,fileName)).isDirectory()){
		return path.resolve(config.inputDirectory,fileName)
	}else{
		return undefined
	}
});

files=files.filter(function(file){if(file){return file}else{return false}})
files.sort(function(a,b){
	if(!config.reverse)
		return fs.statSync(path.resolve(config.inputDirectory,b)).size-fs.statSync(path.resolve(config.inputDirectory,a)).size
	else
		return fs.statSync(path.resolve(config.inputDirectory,a)).size-fs.statSync(path.resolve(config.inputDirectory,b)).size
})


console.dlog('Files:')
console.dlog(files)

var logFile=fs.createWriteStream(path.resolve(config.resultDirectory,config.configName+'-covFuzz.log'))

var fileList=[];
var totalFiles=0;
var noBlocks=0;

var returns=1
ASAN.setMaxBlockCount(config.maxBlockCount)
var unlinking=false;
function generateNewFiles(number){
	ASAN.setMaxBlockCount(1);
	var sampleFiles=fs.readdirSync(config.tempDirectory+'/samples/').map(function(fileName){return path.resolve(config.tempDirectory+'/samples/',fileName)});
	console.log('['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' Corpus size: '+fileList.length+ ' TotalBlocks: '+ASAN.getTotalBlocks())	
	if(sampleFiles.length<1){
		console.log('No new blocks this round. Using fresh samples.')
		sampleFiles=fs.readdirSync(config.outputDirectory).map(function(fileName){return path.resolve(config.outputDirectory,fileName)});
	}
	else{
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
		continueRound(config,x)
}

function endRound(number){
	if(returns==config.instanceCount){
		returns=1
		if(!config.disableLogging){
			var status='['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' Corpus size: '+fileList.length+ ' TotalBlocks: '+ASAN.getTotalBlocks()+'\n'
			logFile.write(status)
		}
		if(totalFiles>=config.maxTestCaseCount || config.analyzeOnly)
			process.exit(1)
		else
			unlinking=true;
		generateNewFiles(number)
	}
	else{
		returns++
	}
}

function saveNewSamples(files,newBlocks){
	console.log('['+(new Date().getTime())+']File(s): '+files.join(' ')+' newblocks:'+newBlocks+' corpussize: '+fileList.length+' totalblocks: '+ASAN.getTotalBlocks())							
	files.forEach(function(file){
		fileList.push(file)
		var fileContent=fs.readFileSync(file)
		var fileName=crypto.createHash('sha1').update(fileContent).digest('hex')
		if(file.indexOf(config.outputDirectory)==-1)
			fs.writeFileSync(path.resolve(config.outputDirectory,path.basename(fileName)+'.'+config.fileExtension),fileContent)
	})
}

function unlinkFiles(files){
	if(unlinking || config.optimize){
		files.forEach(function(file){
			fs.unlinkSync(file)
		})
	}
}

function onTargetExit(stderr,files,number,killed){
	if(!killed){
		var fingerPrint=ASAN.asanFingerPrint(stderr)
		if(fingerPrint !== null){
			if(fingerPrint && fingerPrint!="stack-overflow"){	
				if(!fs.existsSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint,config.target+'-'+fingerPrint+'.txt')) && !fs.existsSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.txt'))){
					if(files.length!=1){
						console.log(stderr)	
						console.log('Repro-file saved to: '+path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.'+config.fileExtension))				
						fs.mkdirSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint))
						files.forEach(function(file,index){	
							fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint,config.target+'-'+fingerPrint+index+'.'+config.fileExtension),fs.readFileSync(file))
							fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint,config.target+'-'+fingerPrint+'.txt'),stderr)
						})
					}else{
						console.log(stderr)	
						console.log('Repro-file saved to: '+path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.'+config.fileExtension))
						fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.'+config.fileExtension),fs.readFileSync(files[0]))
						fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.txt'),stderr)
					}
				}
				else{
					console.log('Dupe: '+path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.'+config.fileExtension))
				}
			}
			unlinkFiles(files)
		}
		else if(config.analyzeCoverage){
			var coverageData=ASAN.getCoverageData(number)
			var currentBlocks=ASAN.getTotalBlocks();
			if(ASAN.isKeeper(coverageData)){
				var newBlocks=ASAN.getTotalBlocks()-currentBlocks
				saveNewSamples(files,newBlocks)
			}
			else{
				noBlocks++;		
	         	unlinkFiles(files)	
		    }
		}
	}
	else{
		unlinkFiles(files)
	}
	continueRound(config,number)
}

function continueRound(config,number){
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
			console.log('['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' Corpus size: '+fileList.length+ ' TotalBlocks: '+ASAN.getTotalBlocks())
		totalFiles+=file.length
		spawnTarget(file,number,onTargetExit)
	}
	else{
		endRound(number)
	}
}

function ra(array){
	return array[Math.floor(Math.random()*array.length)]
}

var spawnTarget=(require('./src/spawn.js'))(config)

for(var x=0; x<config.instanceCount; x++){
	if(!fs.existsSync(config.tempDirectory+'/'+x))
		fs.mkdirSync(config.tempDirectory+'/'+x);
	continueRound(config,x)
}