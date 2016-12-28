#!/usr/bin/env node

var S=require('surku');
var net=require('net');
var spawn=require('child_process').spawn;
var fs=require('fs');
var path=require('path');
var crypto=require('crypto');


var config;
var samples={
	allSamples:[],
	topSamples:[]
};


var fileCount=0;


process.on('message',messageHandler);

var messageTypes={
	'init':init,
	'trim':trim,
	'updateTestCase':updateTestCase,
	'samplesLow':generateNewTestCase
};

function messageHandler(message){
	if(messageTypes.hasOwnProperty(message.type)){
		messageTypes[message.type](message.data);
	}
	else{
		console.log('No message type: '+message.type);
	}
}

/*
	List files from inputDirectory and sort by size.
*/
function init(conf){
	var inputDirectory="";
	if(config===undefined){
		config=conf;
		inputDirectory=config.inputDirectory;
	}
	else{
		inputDirectory=config.outputDirectory;
	}
	var allSamples=fs.readdirSync(inputDirectory).map(function(fileName){
	if(!fs.statSync(path.resolve(inputDirectory,fileName)).isDirectory()){
		return path.resolve(inputDirectory,fileName);
	}else{
		return undefined;
	}
	});
	samples={
		allSamples:[],
		topSamples:[]
	};
	allSamples=allSamples.filter(function(file){
		if(file){
			return file;
		}else{
			return false;
		}
	});
	allSamples.sort(function(a,b){
		if(config.reverse)
			return fs.statSync(path.resolve(inputDirectory,b)).size-fs.statSync(path.resolve(inputDirectory,a)).size;
		else
			return fs.statSync(path.resolve(inputDirectory,a)).size-fs.statSync(path.resolve(inputDirectory,b)).size;
	});
	startRadamsa(allSamples);
	process.send({type:'initReady',data:{files:allSamples}});
}

function trim(){
	console.log('TRIMMING');
	if(config.filterInputFolder===true){
		console.log("Enabling brutal removing.");
		config.deleteFiles=true;
	}

	samples.allSamples.sort(function(a,b){
		return ((a.exec_time)/a.testCaseBlocks-(b.exec_time)/b.testCaseBlocks);
	});

	var allSamples=[];
	for(var x=0; x<samples.allSamples.length; x++){

		allSamples.push(samples.allSamples[x].file);
	}

	samples={
		allSamples:[],
		topSamples:[]
	};

	process.send({type:'initReady',data:{files:allSamples}});
}


/*
	updateTestCase-message handler
*/
function updateTestCase(message){
	if(message.action=='remove')
		removeTestCase(message.data);
	else if(message.action=='save')
		saveNewSamples(message.data);
	if(!message.data.noNew)
		generateNewTestCase();
	else{
		newTestCase(undefined);
	}
}


/*
	Save new sample to outputDirectory
*/
function saveNewSamples(data){
	//newBlocks:newBlocks,testCaseBlocks:testCaseBlocks

	var fileContent=fs.readFileSync(data.file);
	var original=path.resolve(data.file);
	var fileName=crypto.createHash('sha1').update(fileContent).digest('hex');
	var fullName=path.resolve(config.outputDirectory,path.basename(fileName)+path.extname(data.file));
	if(!fs.existsSync(fullName))
		fs.writeFileSync(fullName,fileContent);
	var fileStats={
			file:fullName,
			newBlocks:data.newBlocks,
			testCaseBlocks:data.testCaseBlocks,
			exec_time:data.exec_time,
			size:fileContent.length
		};
	samples.allSamples.push(fileStats);
	var cloneStat=Object.assign({},fileStats);
		cloneStat.weight=200;
	samples.topSamples.push(cloneStat);
	console.log('['+(new Date().getTime())+']File: '+fullName+' newblocks:'+data.newBlocks+' corpussize: '+samples.allSamples.length+' totalblocks: '+data.totalBlocks);
	if( original != fullName){
		removeTestCase(data);
	}
}

/*
	Remove sample from lists
*/
function removeTestCase(data){

	var file=path.resolve(data.file);
	var inInputDir=(path.resolve(file).indexOf(config.inputDirectory)!=-1);
	var inOutputDir=(path.resolve(file).indexOf(config.outputDirectory)!=-1);
	if((!inInputDir || config.deleteFiles) && fs.existsSync(file)){
		if(inInputDir||inOutputDir){
			for(var x=0; x<samples.allSamples.length; x++){
				if(samples.allSamples[x].file==file){
					samples.allSamples.splice(x,1);
				}
			}
			for(var y=0; y<samples.topSamples.length; y++){
				if(samples.topSamples[y].file==file){
					samples.topSamples.splice(y,1);
				}
			}
		}
		fs.unlink(file);
	}
}


function rint(max){
	return Math.floor(Math.random()*max);
}

function ra(arr){
	return arr[rint(arr.length)];
}

/*
	Select sample for surku and call surku to generate new test case.
*/
function generateNewTestCase(){
	if(samples.topSamples.length>0 && rint(3)){
		var sample=samples.topSamples.splice(rint(samples.topSamples.length),1)[0];
		var newWeight=sample.weight-1;
		if(newWeight>0)
			samples.topSamples.push({file:sample.file,weight:newWeight});
		generate(sample.file,newTestCase);
	}
	else if(samples.allSamples.length>0){
		generate(ra(samples.allSamples).file,newTestCase);
	}
	else{
		console.log('No samples.');
	}
}
var surkuConfig={
	maxMutations:20,
	minMutations:1,
	chunkSize:3000
};
var surku=new S(surkuConfig);

function getTestCase(callback){
	var client = net.connect((config.port+1), 'localhost');
	var data;
	var timeout
	client.setTimeout(5000,function(e){
		this.destroy();
	});
	client.on('data', function(d) {
		if(timeout)
			clearTimeout(timeout)
		setTimeout(function(){client.destroy()},100)
		if(data===undefined)
			data=d;
		else
			data=Buffer.concat([data,d]);
	});
	client.on('close', function() {
		clearTimeout(timeout)
		var prefix=new Date().getTime();
		fileCount++;

		var fileName=config.tempDirectory+'/samples/'+prefix+fileCount+'.'+config.extension;
		fs.writeFile(fileName,data,function(){
			callback(fileName);
		});
	});
	client.on('error', function(e) {
		console.log('socket error: '+e);
		this.destroy();
	});

	}


var radamsa={
	radamsaFunction:getTestCase,
	start:startRadamsa,
	running:false
};

function startRadamsa(initSamples){
	var extraParams=[];
	//extraParams=['-m','num=30','ld','lds','lr2','li','lr','ls','lp','td','ts1','ts2','tr','ft','fn','fo']
	var allSamples=[];
	if(samples.allSamples.length>0){
		for(var x=0; x<samples.allSamples.length;x++){
			allSamples.push(samples.allSamples[x].file);
			if(x>5000)
				break;
		}
	}
	else{
		allSamples=initSamples;
	}
	allSamples=allSamples.slice(0,5000);
	radamsa.radamsa = spawn(config.radamsaPath,['-n',config.filesPerRound].concat(extraParams).concat(['-o',':'+(config.port+1)]).concat(allSamples));
	radamsa.radamsa.stderr.on('data',function(data){
		console.log('Radamsa error:'+data.toString());
	});
	radamsa.radamsa.stdout.on('data',function(data){
		console.log(data.toString());
	});

	radamsa.radamsa.on('exit',function(){
		startRadamsa();
	});
}


function generate(sampleFile,callback){
	if(Math.random()>0.5 && radamsa.radamsa.exitCode===null){
		radamsa.radamsaFunction(callback);
	}
	else{
		surkuFunction(sampleFile,callback);
	}
}


/*
	Generate new test case and write it to file.
	TODO: To avoid extra readFileSync, maybe generate multiple test cases from same input-file.
*/
function surkuFunction(sampleFile,callback){
	if(sampleFile){
		var prefix=new Date().getTime();
		fileCount++;
		var fileName=config.tempDirectory+'/samples/'+prefix+fileCount+path.extname(sampleFile);
		var fileContent=fs.readFileSync(sampleFile);
		var chunkSize=Math.ceil(fileContent.length/100);
		if(chunkSize>3000){
			surku.config.chunkSize=3000;
		}else if(chunkSize<500){
			surku.config.chunkSize=500;
		}
		else{
			surku.config.chunkSize=chunkSize;
		}
		fs.writeFile(fileName,surku.generateTestCase(fileContent),function(){
			callback(fileName);
		});
	}
}

function newTestCase(fileName){
	process.send({
			type:'newTestCase',
			data:{
				file:fileName,
				corpusSize:samples.allSamples.length
			}
		});
}

process.on('disconnect',function(e){
	console.log("testcasegen.js error:"+e);
	process.exit();
});
