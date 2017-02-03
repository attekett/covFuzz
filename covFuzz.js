#!/usr/bin/env node

var fs=require('fs');
var path=require('path');
var fork=require('child_process').fork;

var config=require(path.resolve(__dirname,'./src/cmd.js'));
var instrumentation=require(config.instrumentationPath);
var testcasegen=fork(config.testCaseGen);

if(instrumentation.init)
    instrumentation.init(config);
console.dlog('Instrumentation loaded.');
instrumentation.getCoverageData=instrumentation.getCoverageData.bind(config);

console.fileLog(JSON.stringify({type:'Configuration',data:config}, null, ' '));

var freeWorkDirs=[];
for(var x=0; x<config.instanceCount; x++){
    var workDir=path.resolve(config.tempDirectory,""+x);
    if(!fs.existsSync(workDir)){
        fs.mkdirSync(workDir);
    }
    else{
        instrumentation.clearWorkDir(workDir);
    }
    freeWorkDirs.push(workDir);
}

testcasegen.on('disconnect',function(){
    testcasegen.sendMessage=function(){};
    console.log('Test case generator exited.');
    console.log('Aborting...');
    process.exit();
});

testcasegen.sendMessage=function(type,data){
    this.send({type:type,data:data});
};


var messageTypes={
    'newTestCase':newTestCase,
    'initReady':initReady
};


function maxTestCaseCount(){
    consoleLogstatus('maxTestCaseCount');
    fileLogStatus('maxTestCaseCount');
    process.exit();
}

function messageHandler(message){
    if(messageTypes.hasOwnProperty(message.type)){
       messageTypes[message.type](message.data);
    }
    else{
       console.log('No message type: '+message.type);
    }
}

testcasegen.on('message',messageHandler);

function fileLogStatus(type){
    var curCorpus=stats.corpusSize;
    if(curCorpus<stats.trimCorpusSize)
        curCorpus=stats.trimCorpusSize;
    console.fileLog(JSON.stringify(
       {
         type:type,
         data:{
            start_time:start_time,
            cur_time:(new Date().getTime()),
            scanned_files:stats.totalFiles,
            blocks:instrumentation.getTotalBlocks(),
            time:timeSpent(),
            testspersecond:speed(stats.totalFiles),
            corpussize:curCorpus,
            crashes:stats.crashes}
         },
       null,' '
    ));
}

function consoleLogstatus(type){
    console.log('['+(new Date().getTime())+'] '+type+':'+
        ' Files scanned: '+stats.totalFiles+
        ' Corpussize:'+stats.corpusSize+
        ' TotalBlocks: '+instrumentation.getTotalBlocks()+
        ' Time: '+timeSpent()+
        ' testspersecond: '+speed(stats.totalFiles));
}

var stats={
    trimCount:0,
    crashes:{},
    initialTestCases:0,
    corpusSize:0,
    trimCorpusSize:0,
    totalFiles:0,
    noBlocks:0,
    lastTrim:0
};

var maxTempTestCases=0;
var availableTestCases=[];
var trim=false;
var initialization=true;

function initReady(data){
    console.log('INIT ready');
    initialization=true;    
    stats.trimCorpusSize=stats.corpusSize;
    instrumentation.clearCoverage();
    availableTestCases=[];
    for(var x=0; x<data.files.length;x++)
        availableTestCases[x]=data.files[x];
    if(availableTestCases.length<config.instanceCount){
        console.log('Not enough input-files: You have to have more input-files than parallel instances.');
        process.exit(0);
    }
    stats.initialTestCases=stats.totalFiles+availableTestCases.length;
    if(data.trim){
        stats.lastTrim=stats.totalFiles;
        maxTempTestCases=config.maxTempTestCases;
    }
    while(freeWorkDirs.length>0){
        var testCase=getNextTestCase();
        spawnTarget(testCase,freeWorkDirs.pop(),onTargetExit);
    }
}

function newTestCase(data){
    if(data.file)
       availableTestCases.push(data.file);
    if(data.corpusSize)
        stats.corpusSize=data.corpusSize+1;
    if(freeWorkDirs.length>0){
        var nextTestCase=getNextTestCase();
        if(nextTestCase){
            spawnTarget(nextTestCase,freeWorkDirs.pop(),onTargetExit);
        }
        else if(trim && freeWorkDirs.length==config.instanceCount){
            console.log('trim');
            trim=false;
            testcasegen.sendMessage('trim',config);
        }
    }
}

function getNextTestCase(){
    var nextTestCase=availableTestCases.shift();
    return nextTestCase;
}

function updateCrashes(fingerPrint){
    if(!stats.crashes[fingerPrint])
       stats.crashes[fingerPrint]={count:1,fingerPrint:fingerPrint,first_seen:(new Date().getTime())};
    else
       stats.crashes[fingerPrint].count++;
}

instrumentation.setMaxBlockCount(config.initialMaxBlockCount);

var start_time=new Date().getTime();


/*
    Used time calc
*/
function timeSpent(){
    var end_time = new Date().getTime();
    var elapsed_ms = end_time - start_time;
    var seconds = Math.floor(elapsed_ms / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);

    return hours+':'+(minutes%60)+':'+(seconds%60);
}
/*
    Average speed tests/s
*/
function speed(totalFiles){
    var cur_time=new Date().getTime();
    var seconds=(cur_time-start_time)/1000;
    var speed=Math.round(totalFiles/seconds);
    return speed+' tests/s';
}

/*
    send message to testcasegen that the file should be removed
*/
function removeTestCase(workDir,file){
    if(freeWorkDirs.indexOf(workDir)==-1)
       freeWorkDirs.push(workDir);

    var message={
         action:'remove',
         data:{
          file:file
         }
       };
    if(availableTestCases.length>=maxTempTestCases){
       message.data.noNew=true;
    }
    console.dlog('updateTestCase: '+JSON.stringify(message));
    testcasegen.sendMessage('updateTestCase',message);
}
/*
    send message to testcasegen that the file should be saved
*/
function saveTestCase(workDir,file,currentBlocks,testCaseBlocks,exec_time){
    if(freeWorkDirs.indexOf(workDir)==-1)
       freeWorkDirs.push(workDir);
    var newBlocks=instrumentation.getTotalBlocks()-currentBlocks;

    var message={
            action:'save',
            data:{
                file:file,
                newBlocks:newBlocks,
                exec_time:exec_time,
                testCaseBlocks:testCaseBlocks,
                totalBlocks:instrumentation.getTotalBlocks()
            }
        };

    if(availableTestCases.length>=maxTempTestCases){
       message.data.noNew=true;
    }
    console.dlog('updateTestCase: '+JSON.stringify(message));
    testcasegen.sendMessage('updateTestCase',message);
}

/*
    Save crash reproducing file and the stderr output.
*/
function writeResult(fingerPrint,file,stderr){
    var extension=path.extname(file);
    updateCrashes(fingerPrint);
    if(!fs.existsSync(config.resultDirectory)){
        console.log("Warning: Results directory doesn't exits.");
        console.log('Trying to create.');
        fs.mkdirSync(config.resultDirectory);
    }
    var reproPath=path.resolve(
        config.resultDirectory,
        config.target+'-'+fingerPrint+extension
       );
    var txtPath=path.resolve(
        config.resultDirectory,
        config.target+'-'+fingerPrint+'.txt'
       );

    if(!fs.existsSync(txtPath) && !fs.existsSync(reproPath)){
        fs.writeFileSync(reproPath,fs.readFileSync(file));
        fs.writeFileSync(txtPath,stderr);
        console.log('Repro-file saved to: '+reproPath);
    }
    else{
        console.log('Dupe: '+reproPath);
    }
}

/*
    Handler for target software exit. Checks if instrumentation caught something new and if we got new coverage.
*/
function onTargetExit(stdout,stderr,file,workDir,killed,exit_code,exec_time){
    console.dlog('onTargetExit '+JSON.stringify(arguments));
    if(file===undefined){
       if(freeWorkDirs.indexOf(workDir)==-1)
            freeWorkDirs.push(workDir);
       return null;
    }
    stats.totalFiles++;
    if(stats.initialTestCases==stats.totalFiles){
       console.log('Analysis run completed.');
       consoleLogstatus('Status');
       instrumentation.setMaxBlockCount(1);
       if(stats.trimCount===0){
            instrumentation.setMaxBlockCount(config.maxBlockCount);
            stats.trimCount++;
            trim=true;
        }
    }
    if(stats.totalFiles%100===0){
       consoleLogstatus('Status');
    }
    if(stats.lastTrim!==0 && stats.totalFiles%(config.trimFrequency+stats.lastTrim)===0){
        console.log('Starting trim.');
        instrumentation.setMaxBlockCount(config.maxBlockCount);
        maxTempTestCases=0;
        trim=true;
    }

    if(!killed){
        var fingerPrint=instrumentation.fingerPrint(stdout,stderr);
        //null, if no error and we want to analyze the coverage
        //false|0|undefined, if there was an error we don't want to save
        //fingerPrint set, if there was something we want to save
        if(fingerPrint !== null){
            if(fingerPrint){
                writeResult(fingerPrint,file,stderr);
            }
            removeTestCase(workDir,file);
        }
        else if(config.analyzeCoverage){
            var coverageData=instrumentation.getCoverageData(workDir);
            var currentBlocks=instrumentation.getTotalBlocks();
            var analysis=instrumentation.isKeeper(coverageData);
            if(analysis.keeper){
                saveTestCase(workDir,file,currentBlocks,analysis.blocks,exec_time);
            }
            else{
                stats.noBlocks++;
                removeTestCase(workDir,file);
            }
        }
    }
    else{
       instrumentation.clearWorkDir(workDir);
       if(freeWorkDirs.indexOf(workDir)==-1)
            freeWorkDirs.push(workDir);
       removeTestCase(workDir,file);
    }

    if(stats.totalFiles==config.maxTestCaseCount){
       maxTestCaseCount();
    }
}

var spawnTarget=(require('./src/spawn.js'))(config);

testcasegen.sendMessage('init',config);

if(config.analyzeOnly){
    maxTempTestCases=0;
}

setInterval(function(){
    fileLogStatus('status');
},60*1000);

