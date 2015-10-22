#!/usr/bin/env node

var fs=require('fs')
var path=require('path')
var fork=require('child_process').fork

var config=require('./src/cmd.js')
var instrumentation=require(config.instrumentationPath)

if(instrumentation.init)
	instrumentation.init(config)
console.dlog('Instrumentation loaded.')
instrumentation.getCoverageData=instrumentation.getCoverageData.bind(config)

console.fileLog('Configuration:\n'+JSON.stringify(config, null, ' '),'INFO')

var freeWorkDirs=[]
for(var x=0; x<config.instanceCount; x++){
	if(!fs.existsSync(config.tempDirectory+'/'+x)){
		fs.mkdirSync(config.tempDirectory+'/'+x);
	}
	freeWorkDirs.push(config.tempDirectory+'/'+x)
}


var testcasegen=fork(__dirname+'/src/testcasegen.js')

testcasegen.sendMessage=function(type,data){
	this.send({type:type,data:data})
}

var messageTypes={
	'newTestCase':newTestCase,
	'initReady':initReady
}

function messageHandler(message){
	if(messageTypes.hasOwnProperty(message.type)){
		messageTypes[message.type](message.data)
	}
	else{
		console.log('No message type: '+message.type)
	}
}

testcasegen.on('message',messageHandler)


var availableTestCases=[]
var initialTestCases=0
function initReady(data){
	availableTestCases=[]
	for(var x=0; x<data.files.length;x++)
		availableTestCases[x]=data.files[x]
	initialTestCases=availableTestCases.length
	while(freeWorkDirs.length>0){
		spawnTarget(getNextTestCase(),freeWorkDirs.pop(),onTargetExit)
	}
}

function newTestCase(data){
	if(data.file)
		availableTestCases.push(data.file)
	if(freeWorkDirs.length>0){
		spawnTarget(getNextTestCase(),freeWorkDirs.pop(),onTargetExit)
	}
}

function getNextTestCase(){
	var nextTestCase=availableTestCases.shift()
	if(availableTestCases.length<20 && !config.analyzeOnly){	
		testcasegen.sendMessage('samplesLow')
	}
	else if(availableTestCases.length==0){
		process.exit()
	}
	return nextTestCase
}


/*
	Couple of random helpers
*/
function rint(max){
	return Math.floor(Math.random()*max)
}

function ra(array){
	return array[Math.floor(Math.random()*array.length)]
}

var fileList=[];
var totalFiles=0;
var noBlocks=0;
var returns=1

instrumentation.setMaxBlockCount(config.maxBlockCount)

var start_time=new Date().getTime()


/*
	Used time calc
*/
function timeSpent(){
	var end_time = new Date().getTime();
	var elapsed_ms = end_time - start_time;
	var seconds = Math.floor(elapsed_ms / 1000);
	var minutes = Math.floor(seconds / 60);
	var hours = Math.floor(minutes / 60);

	return hours+':'+(minutes%60)+':'+(seconds%60)
}
/*
	Average speed tests/s
*/
function speed(totalFiles){
	var cur_time=new Date().getTime()
	var seconds=(cur_time-start_time)/1000
	var speed=Math.round(totalFiles/seconds)
	return speed+' tests/s'
}

/*
	send message to testcasegen that the file should be removed
*/
function removeTestCase(workDir,file){
	if(freeWorkDirs.indexOf(workDir)==-1)
		freeWorkDirs.push(workDir)
	if(availableTestCases.length<config.maxTempTestCases){
		testcasegen.sendMessage('updateTestCase',{action:'remove',data:{file:file}})
	}else{
		testcasegen.sendMessage('updateTestCase',{action:'remove',data:{file:file,noNew:true}})
	}
}
/*
	send message to testcasegen that the file should be saved	
*/
function saveTestCase(workDir,file,currentBlocks){
	if(freeWorkDirs.indexOf(workDir)==-1)
		freeWorkDirs.push(workDir)
	var newBlocks=instrumentation.getTotalBlocks()-currentBlocks
	if(availableTestCases.length<config.maxTempTestCases){
		testcasegen.sendMessage('updateTestCase',{action:'save',data:{file:file,newBlocks:newBlocks,totalBlocks:instrumentation.getTotalBlocks()}})        		
	}else{
		testcasegen.sendMessage('updateTestCase',{action:'save',data:{file:file,newBlocks:newBlocks,totalBlocks:instrumentation.getTotalBlocks(),noNew:true}})        		
	}
}

/*
	Save crash reproducing file and the stderr output.
*/
function writeResult(fingerPrint,file,stderr){
	var extension=path.extname(file)
	if(!fs.existsSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint,config.target+'-'+fingerPrint+'.txt')) && !fs.existsSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.txt'))){
		console.log('Repro-file saved to: '+path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+extension))
		fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+extension),fs.readFileSync(file))
		fs.writeFileSync(path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+'.txt'),stderr)
	}
	else{
		console.log('Dupe: '+path.resolve(config.resultDirectory,config.target+'-'+fingerPrint+extension))
	}
}

/*
	Handler for target software exit. Checks if instrumentation caught something new and if we got new coverage.
*/
function onTargetExit(stderr,file,workDir,killed){
	if(file===undefined){
		if(freeWorkDirs.indexOf(workDir)==-1)
			freeWorkDirs.push(workDir)
		return null
	}
	totalFiles++
	if(initialTestCases==totalFiles){
		console.log('Initial run finished. Starting fuzzing.')
		console.log('['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' TotalBlocks: '+instrumentation.getTotalBlocks()+' Time: '+timeSpent()+' Speed: '+speed(totalFiles))	
		instrumentation.setMaxBlockCount(1)
	}
	if(totalFiles%100==0){
		console.log('['+(new Date().getTime())+'] Status: Files scanned: '+totalFiles+' TotalBlocks: '+instrumentation.getTotalBlocks()+' Time: '+timeSpent()+' Speed: '+speed(totalFiles))	
		console.fileLog('Status:\n'+JSON.stringify({scanned_files:totalFiles,blocks:instrumentation.getTotalBlocks(),time:timeSpent(),speed:speed(totalFiles)}, null, ' '),'INFO')		
	}
	if(!killed){
		var fingerPrint=instrumentation.fingerPrint(stderr)
		if(fingerPrint !== null){
			if(fingerPrint && fingerPrint!="stack-overflow"){	
				writeResult(fingerPrint,file,stderr)
			}
			removeTestCase(workDir,file)
		}
		else if(config.analyzeCoverage){
			var coverageData=instrumentation.getCoverageData(workDir)
			var currentBlocks=instrumentation.getTotalBlocks();

			if(instrumentation.isKeeper(coverageData)){
				
				saveTestCase(workDir,file,currentBlocks)
		    }
			else{
				noBlocks++;	
				removeTestCase(workDir,file)
			}
		}
	}
	else{
		if(freeWorkDirs.indexOf(workDir)==-1)
			freeWorkDirs.push(workDir)
		removeTestCase(workDir,file)
	}
}

var spawnTarget=(require('./src/spawn.js'))(config)

testcasegen.sendMessage('init',config)

if(config.analyzeOnly){
	config.maxTempTestCases=0
}