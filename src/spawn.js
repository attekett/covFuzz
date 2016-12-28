#!/usr/bin/env node

var path=require('path');
var events = require('events');
var spawn=require('child_process').spawn;

module.exports=function(config){

	var outOfFilesCounter=0;

	function spawnTarget(file,workDir,callback){
		var statusEmitter = new events.EventEmitter();
		if(file===undefined){
			outOfFilesCounter++;
			if(outOfFilesCounter>1000){
				console.log('Something is wrong...');
				process.exit();
			}
			console.log('Out of samples...');
			callback(null,file,workDir,true);
			return null;
		}
		outOfFilesCounter=0;
		var environment=Object.create(process.env);
		if(config.env && config.analyzeCoverage){
			for(var option in config.env){
				environment[option]=config.env[option].replace('__workDir__',workDir).replace('__SHM_ID__',config.shmid);
			}
		}

		file=path.relative(process.cwd(),file);
		var start_time=new Date().getTime();
		var commandLine=config.configureCommandline(file,workDir,environment);
		var target=spawn(config.targetBin,commandLine,{env:environment});
		var stderr="";
		var stdout="";
		var killed=false;
		var killObserver=function(){
			killed=true;
		};
		statusEmitter.on('kill',killObserver);
		console.dlog(file);
		/*
		//TODO: Do we really need this for anything???
		var stateObserver=setInterval(function(){
			if(fs.existsSync('/proc/'+target.pid+'/stat')){
				var status=fs.readFileSync('/proc/'+target.pid+'/stat').toString().split(' ')[2]
				if(status!='R' && status!='D'){
					statusCount++;
					if(statusCount>2){
						clearInterval(stateObserver)
						target.stderr.removeAllListeners('data')
						target.kill(config.killSignal)
					}
				}else{
					statusCount=0;
				}
			}else{
				console.dlog('No stat file.')
				clearInterval(stateObserver)
				target.stderr.removeAllListeners('data')
				target.kill(config.killSignal)
			}
		},config.sleepTimeout/2)*/
		target.stderr.on('data',function(data){
		//	console.log("Target pid: "+target.pid+" Workdir: "+workDir+"\n")//+data.toString())
			if(stderr!=="" || data.toString().indexOf(config.instrumentationHook)!=-1){
				var newData=data.toString();
				stderr+=newData;

			}
		});
		target.stdout.on('data',function(data){
		//	console.log("Target pid: "+target.pid+" Workdir: "+workDir+"\n")//+data.toString())
			if(stdout!=="" || data.toString().indexOf(config.instrumentationHook)!=-1){
				var newData=data.toString();
				stdout+=newData;

			}
		});
		target.on('exit',function(code){
			clearTimeout(target.timeout);
			statusEmitter.removeListener('kill', killObserver);
			var exec_time=(new Date().getTime())-start_time;
			callback(stdout,stderr,file,workDir,killed,code,exec_time);
		});
		target.timeout=setTimeout(function(){
			console.log('[Single]Timeout kill.');
			statusEmitter.emit('kill');
			target.kill(config.killSignal);
		},config.killTimeout);
	}
	return spawnTarget;
};
