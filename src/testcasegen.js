
var config
var samples={
	allSamples:[],
	topSamples:[]
}
var fs=require('fs')
var path=require('path')
var fileCount=0

var crypto=require('crypto')

process.on('message',messageHandler)

var messageTypes={
	'init':init,
	'updateTestCase':updateTestCase,
	'samplesLow':generateNewTestCase
}

var config
function messageHandler(message){
	if(messageTypes.hasOwnProperty(message.type)){
		messageTypes[message.type](message.data)
	}
	else{
		console.log('No message type: '+message.type)
	}
}

/*
	List files from inputDirectory and sort by size.
*/
function init(conf){
	config=conf
	var allSamples=fs.readdirSync(config.inputDirectory).map(function(fileName){
	if(!fs.statSync(path.resolve(config.inputDirectory,fileName)).isDirectory()){
		return path.resolve(config.inputDirectory,fileName)
	}else{
		return undefined
	}
	});

	allSamples=allSamples.filter(function(file){if(file){return file}else{return false}})
	allSamples.sort(function(a,b){
		if(config.reverse)
			return fs.statSync(path.resolve(config.inputDirectory,b)).size-fs.statSync(path.resolve(config.inputDirectory,a)).size
		else
			return fs.statSync(path.resolve(config.inputDirectory,a)).size-fs.statSync(path.resolve(config.inputDirectory,b)).size
	})
	process.send({type:'initReady',data:{files:allSamples}})
}

/*
	updateTestCase-message handler
*/
function updateTestCase(message){
	if(message.action=='remove')
		removeTestCase(message.data)
	else if(message.action=='save')
		saveNewSamples(message.data)
	if(fileCount==config.maxTestCaseCount){
		process.send({type:'maxTestCaseCount'})
	}
	if(!message.data.noNew)
		generateNewTestCase()
	else
		newTestCase(undefined)
}


/*
	Save new sample to outputDirectory
*/
function saveNewSamples(data){
	var fileContent=fs.readFileSync(data.file)
	var original=path.resolve(data.file)
	var fileName=crypto.createHash('sha1').update(fileContent).digest('hex')
	var fullName=path.resolve(config.outputDirectory,path.basename(fileName)+path.extname(data.file))
	fs.writeFileSync(fullName,fileContent)
	samples.allSamples.push(fullName)
	samples.topSamples.push({file:fullName,weight:200})
	console.log('['+(new Date().getTime())+']File: '+fullName+' newblocks:'+data.newBlocks+' corpussize: '+samples.allSamples.length+' totalblocks: '+data.totalBlocks)									
	if( original != fullName){
		removeTestCase(data)
	}
}

/*
	Remove sample from lists
*/
function removeTestCase(data){
	var file=path.resolve(data.file)
	var inInputDir=(path.resolve(file).indexOf(config.inputDirectory)!=-1)
	var inOutputDir=(path.resolve(file).indexOf(config.outputDirectory)!=-1)
	if(!inInputDir && fs.existsSync(file)){
		if(inInputDir||inOutputDir){
			if(samples.allSamples.indexOf(file)!=-1){
				samples.allSamples.splice(samples.allSamples.indexOf(file),1)
			}
			for(var x=0; x<samples.topSamples.length; x++){
				if(samples.topSamples[x].file==file){
					samples.topSamples.splice(x,1)		
				}
			}
		}
		fs.unlink(file)
	}
}


function rint(max){
	return Math.floor(Math.random()*max)
}

function ra(arr){
	return arr[rint(arr.length)]
}

/*
	Select sample for surku and call surku to generate new test case.
*/
function generateNewTestCase(){
	if(samples.topSamples.length>1 && rint(3)){
		var sample=samples.topSamples.splice(rint(samples.topSamples.length),1)[0]
		var newWeight=sample.weight-1
		if(newWeight>0)
			samples.topSamples.push({file:sample.file,weight:newWeight})
		surkuFunction(sample.file,newTestCase)
	}
	else{
		surkuFunction(ra(samples.allSamples),newTestCase)
	}
}
var surkuConfig={
	maxMutations:20,
	minMutations:1,
	chunkSize:3000
}
var S=require('surku');
var surku=new S(surkuConfig)
/*
	Generate new test case and write it to file.
	TODO: To avoid extra readFileSync, maybe generate multiple test cases from same input-file.
*/
function surkuFunction(sampleFile,callback){
	if(sampleFile){
		var prefix=new Date().getTime()
		fileCount++
		var fileName=config.tempDirectory+'/samples/'+prefix+fileCount+path.extname(sampleFile)
		var fileContent=fs.readFileSync(sampleFile)
		var chunkSize=Math.ceil(fileContent.length/100)
		if(chunkSize>3000){
			surku.config.chunkSize=3000
		}else if(chunkSize<500){
			surku.config.chunkSize=500
		}
		else{
			surku.config.chunkSize=chunkSize
		}
		fs.writeFile(fileName,surku.generateTestCase(fileContent),function(){
			callback(fileName)
		})
	}
}

function newTestCase(fileName){
	process.send({type:'newTestCase',data:{file:fileName,corpusSize:samples.allSamples.length}})
}

process.on('disconnect',function(){
	process.exit()
})
process.on('error',function(){
	process.exit()
})
process.on('exit',function(){
	process.exit()
})
process.on('SIGINT',function(){
	process.exit()
})