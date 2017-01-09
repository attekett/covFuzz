#!/usr/bin/env node

var fs=require('fs');
var path=require('path');
var crypto=require('crypto');


var config;
var samples={
    allSamples:[],
    topSamples:[]
};

var testCaseGenerators=[];

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
    if(!config.testCaseGenerators){
       console.log('No test case generators specified.');
       process.exit();
    }

    if(Array.isArray(config.testCaseGenerators)){
        config.testCaseGenerators.forEach(function(generator){
            testCaseGenerators.push(require(generator));
        });
    }
    else{
        testCaseGenerators.push(require(config.testCaseGenerators));
    }

    testCaseGenerators.forEach(function(generator){
        if(generator.hasOwnProperty('init'))
            generator.init(config);
    });

    var allSamples=fs.readdirSync(inputDirectory).map(function(fileName){
    if(!fs.statSync(path.resolve(inputDirectory,fileName)).isDirectory()){
       return path.resolve(inputDirectory,fileName);
    }else{
       return undefined;
    }
    });

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

    process.send({type:'initReady',data:{files:allSamples}});
}

function filterSamples(samples){
  var mode=rint(3);

  if(mode===0){
    console.log('Block mode.');
    samples.allSamples.sort(function(a,b){
        return a.testCaseBlocks-b.testCaseBlocks;
    });
  }
  else if(mode===1){
    console.log('Exec time mode.');
    samples.allSamples.sort(function(a,b){
        return a.exec_time-b.exec_time;
    });
  }
  else{
    console.log('Combined mode.');
    samples.allSamples.sort(function(a,b){
        return ((a.exec_time)/a.testCaseBlocks-(b.exec_time)/b.testCaseBlocks);
    });
  }
}


function trim(){
    console.log('TRIMMING');
    if(config.filterInputFolder===true){
       console.log("Enabling brutal removing.");
       config.deleteFiles=true;
    }

    filterSamples(samples);

    var allSamples=[];
    for(var x=0; x<samples.allSamples.length; x++){
       allSamples.push(samples.allSamples[x].file);
    }

    samples={
       allSamples:[],
       topSamples:[]
    };

    process.send({type:'initReady',data:{trim:true, files:allSamples}});
}


/*
    updateTestCase-message handler
*/
function updateTestCase(message){
    if(message.action=='remove')
       removeTestCase(message.data);
    else if(message.action=='save')
       saveNewSample(message.data);
    if(!message.data.noNew)
       generateNewTestCase();
    else{
       sendNewTestCase(undefined);
    }
}

function generateNewTestCase(){
    var generator=ra(testCaseGenerators);
    generator.generateTestCase(getSampleSet,newTestCase);
}

/*
    Save new sample to outputDirectory
*/
function saveNewSample(data){
    //newBlocks:newBlocks,testCaseBlocks:testCaseBlocks

    fs.readFile(data.file,(err,fileContent)=>{
      if(err){
        console.log('Warning: Failed to save sample '+data.file);
        console.log('This issue can occur when multiple samples have same content.');    
      }
      else{
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
    });
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
function getSampleSet(count){
    if(!count || count<1){
        if(samples.allSamples.length>1000)
            count=1000;
        else
            count=samples.allSamples.length;
    }

    if(samples.topSamples.length===0 && samples.allSamples.length===0){
        console.log('No samples in input queue.');
        process.exit();
    }

    var sampleSet=[];
    while(count--){
        if(samples.topSamples.length>0 && rint(3)){
            var index=rint(samples.topSamples.length);
            var sample=samples.topSamples.splice(index,1)[0];
            var newWeight=sample.weight-1;
            if(newWeight>0)
                samples.topSamples.push({file:sample.file,weight:newWeight});
            sampleSet.push(sample.file);
        }
        else if(samples.allSamples.length>0){
           sampleSet.push(ra(samples.allSamples).file);
        }
        else{
           console.log('No samples.');
        }
    }
    return sampleSet;
}

function newTestCase(file){
    if(!file || file.data.length===0){
        setTimeout(generateNewTestCase,10);
    }
    else if(file.type=="data"){
        var prefix=""+new Date().getTime()+Math.random().split('.')[1];
        var fileName=config.tempDirectory+'/samples/'+prefix+fileCount+path;
        fs.writeFile(fileName,file.data,function(){
         sendNewTestCase(fileName);
        });
    }
    else if(file.type=="file"){
        sendNewTestCase(file.data);
    }
}

function sendNewTestCase(fileName){
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
