#!/usr/bin/env node

var net=require('net');
var spawn=require('child_process').spawn;
var fs=require('fs');

var radamsa;

function radamsaGenerator(conf){
    this.config=conf;
    this.extraArgs=[];
    if(this.config.radamsaArguments)
        this.extraArgs=this.config.radamsaArguments;
    this.samples=[];
    this.updateSamples=function(){
        this.samples=this.getSamples();
    };
    this.startRadamsa=function(){
        var radamsa=this.radamsa;
        radamsa = spawn(this.config.radamsaPath,
            ['-n',this.config.filesPerRound]
            .concat(this.extraArgs)
            .concat(['-o',':'+(this.config.port+1)])
            .concat(this.samples));

        radamsa.stderr.on('data',function(data){
            console.log('Radamsa error:'+data.toString());
        });

        radamsa.stdout.on('data',function(data){
            console.log(data.toString());
        });

        radamsa.on('exit',function(){
            this.updateSamples();
            this.startRadamsa();
        });
    };
    this.getTestCase=function(callback){
        var tempDirectory=this.config.tempDirectory;
        var extension=this.config.extension;
        var client = net.connect((this.config.port+1), 'localhost');
        var data;
        var timeout;
        client.setTimeout(5000,function(){
            this.destroy();
        });
        client.on('data', function(d){
            if(timeout)
                clearTimeout(timeout);
            setTimeout(function(){client.destroy();},100);
            if(data===undefined)
                data=d;
            else
                data=Buffer.concat([data,d]);
        });
        client.on('close', function(){
            clearTimeout(timeout);
            var prefix=new Date().getTime();
            var fileName=tempDirectory+'/samples/'+prefix+'.'+extension;
            fs.writeFile(fileName,data,function(){
                callback({type:"file",data:fileName});
            });
        });
        client.on('error', function(e) {
            console.log('socket error: '+e);
            this.destroy();
        });
    };
}


function init(conf){
    radamsa=new radamsaGenerator(conf);
}

function generateTestCase(getSamples,callback){
    if(!radamsa)
        console.log('No Radamsa!!!');
    else{
        if(radamsa.samples.length===0){
            radamsa.getSamples=getSamples;
            radamsa.updateSamples();
            radamsa.startRadamsa();
        }
        radamsa.getTestCase(callback);
    }
}

module.exports={
    init,
    generateTestCase
};
