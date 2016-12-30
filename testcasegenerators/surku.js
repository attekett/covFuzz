#!/usr/bin/env node

var S=require('surku');
var fs=require('fs');
var path=require('path');

var surkuConfig={
    maxMutations:20,
    minMutations:1,
    chunkSize:3000
};
var surku=new S(surkuConfig);

function init(config){
    surkuConfig.tempDirectory=config.tempDirectory;
}

function generateTestCase(getSample,callback){
        //console.log('surku')
        var prefix=new Date().getTime()+Math.random().toString().split('.')[1];
        var sampleFile=getSample(1)[0];
        if(sampleFile){
            var fileName=surkuConfig.tempDirectory+'/samples/'+prefix;
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
            var testCase=surku.generateTestCase(fileContent);
            fs.writeFile(fileName,testCase,function(){
                //console.log(fileName)
                //console.log("New length: "+testCase.length+ " Original length: "+fileContent.length)
                callback({type:"file",data:fileName});
            });
        }
        else{
            callback();
        }
}

module.exports={
    init,
    generateTestCase
};
