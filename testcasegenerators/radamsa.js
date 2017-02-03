#!/usr/bin/env node

var net=require('net');
var spawn=require('child_process').spawn;
var path=require('path');
var fs=require('fs');

var radamsa;

function radamsaGenerator(conf){
    var self=this;
    this.config=conf;
    this.extraArgs=[];
    if(this.config.radamsaArguments)
        this.extraArgs=this.config.radamsaArguments;
    this.samples=[];
    this.updateSamples=function(){
        this.samples=radamsa.getSamples();
    };
    this.startRadamsa=function(){
        
    //    console.log(this.config)
        self.radamsa = spawn(self.config.radamsaPath,
            ['-n',self.config.filesPerRound]
            .concat(self.extraArgs)
            .concat(['-o',':'+(self.config.port+1)])
            .concat(self.samples));

        self.radamsa.stderr.on('data',function(data){
            console.log('Radamsa error:'+data.toString());
            if(data.toString().indexOf("Couldn't bind to local port")!=-1){
                console.log('Port '+(self.config.port+1)+' is already in use.');
                console.log('Check if radamsa is already running.');
            }
        });

        self.radamsa.stdout.on('data',function(data){
            console.log(data.toString());
        });

        self.radamsa.on('exit',function(){
            self.updateSamples();
            self.startRadamsa();
        });

    };
    this.getTestCase=function(callback){
        var tempDirectory=this.config.tempDirectory;
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

            if(data){
                clearTimeout(timeout);
                var prefix=new Date().getTime()+Math.random().toString().split('.')[1];
                var fileName=path.join(tempDirectory,'samples',prefix);
                fs.writeFile(fileName,data,function(){
                    callback({type:"file",data:fileName});
                });
            }
            else{
                callback();
            }
        });
        client.on('error', function() {
            this.destroy();
        });
    };
}


function init(conf){
    console.log('Radamsa init.');
    radamsa=new radamsaGenerator(conf);
}

function generateTestCase(getSamples,callback){
    //console.log('radamsa')
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
