

module.exports=function(config){
	var path=require('path')
	var events = require('events');
	var statusEmitter = new events.EventEmitter();
	statusEmitter.setMaxListeners(0)
	var exec=require('child_process').exec
	var spawn=require('child_process').spawn
	var processKill=function(){}
	var processKillTimeout={}
	var mutex=false
	if(config.kill){
		if(Array.isArray(config.kill))
			var processNames=config.kill
		else
			var processNames=config.kill.split(',')
		var killCommand=''
		for(var x=0; x<processNames.length; x++)
						killCommand+='pkill -9 '+processNames[x]+'; '	
		processKill=function(num){
			if(!mutex){
				mutex=true
				clearTimeout(processKillTimeout)
				processKillTimeout=setTimeout(function(){
					clearTimeout(processKillTimeout)
					statusEmitter.emit('kill')
					exec(killCommand,function(err,stdout,stderr){
						console.dlog('[All]Timeout kill.')
					})
					clearTimeout(processKillTimeout)
				},parseInt(config.killTimeout)+2000)
				mutex=false
			}	
		}
	}
	function spawnTarget(file,number,callback){
		var environment=Object.create(process.env)	
		if(config.ASAN_OPTIONS && config.analyzeCoverage){
			environment.ASAN_OPTIONS=config.ASAN_OPTIONS+config.tempDirectory+'/'+number
		}
		file=[path.relative(process.cwd(),file[0])]
		var commandLine=config.configureCommandline(file,number,environment)
		var target=spawn(config.targetBin,commandLine,{env:environment})
		var stderr=""
		var stdout=""
		var killed=false
		var statusCount=0;
		var killObserver=function(){
			killed=true
		}
		statusEmitter.on('kill',killObserver)
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
		},config.sleepTimeout/2)
		target.stderr.on('data',function(data){
			if(stderr!="" || data.toString().indexOf('ERROR: AddressSanitizer')!=-1){
				var newData=data.toString()
				stderr+=newData
				if(newData.indexOf('=='+target.pid+'==ABORTING')!=-1){
					target.kill('SIGKILL')
				}
			}
		})
		target.on('exit',function(code){
			clearInterval(stateObserver)
			clearTimeout(target.timeout)
			statusEmitter.removeListener('kill', killObserver);
			callback(stderr,file,number,killed)
		})
		target.timeout=setTimeout(function(){
			console.dlog('[Single]Timeout kill.')
			statusEmitter.emit('kill')
			target.kill('SIGKILL')
		},config.killTimeout)
		processKill()	
	}
	return spawnTarget
}
