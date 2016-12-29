#!/usr/bin/env node

var fs=require('fs');
var crypto=require('crypto');
var path=require('path');
var maxBlockCount=0;
/*
	Parse crash fingerprint from ASAN-trace: <type>-<offset-frame0>-<offset-frame1>-<offset-frame2>
	TODO: Add support of symbolized traces.
*/
function asanFingerPrint(stdout, stderr,hang){
	if(stderr && stderr.indexOf('ERROR: AddressSanitizer') !=-1){
		var asanTrace=stderr.replace('\n','').replace(/\s+/g,' ').split(' ');
		var fingerPrint="";
		var frame="";
		if(asanTrace.indexOf('AddressSanitizer:')!=-1){
			fingerPrint+=asanTrace[asanTrace.indexOf('AddressSanitizer:')+1];
			if(hang)
				fingerPrint='HANG';
		}
		asanTrace.splice(0,asanTrace.indexOf('AddressSanitizer:'));
		if(asanTrace.indexOf('#0')!=-1){
			frame=asanTrace[asanTrace.indexOf('#0')+1];
			fingerPrint+="-"+frame.substr(frame.length-3,3);
		}
		if(asanTrace.indexOf('#1')!=-1){
			frame=asanTrace[asanTrace.indexOf('#1')+1];
			fingerPrint+="-"+frame.substr(frame.length-3,3);
		}
		if(asanTrace.indexOf('#2')!=-1){
			frame=asanTrace[asanTrace.indexOf('#2')+1];
			fingerPrint+="-"+frame.substr(frame.length-3,3);
		}

		if(fingerPrint===""){
			return null;
		}
		else{
			return fingerPrint;
		}
	}
	else if(hang){
		return 'hang';
	}
	else{
		return null;
	}
}

/*
	Unpack packed sancov-files. Needed with chromium fuzzing.
*/
function unpackSancovPacked(file){
	var cf=fs.readFileSync(file);
	var x=0;
	var unpackedSancov={};

	console.dlog('Packed sancov name: '+file);
	console.dlog('Packed sancov length: '+cf.length);
	if(cf.length>12){
		while(true){
			var header=[cf.readInt32LE(x),cf.readInt32LE(x+4),cf.readInt32LE(x+8)];
			var module=cf.slice(x+12,x+12+header[1]).toString().split('.')[0];
			var data=cf.slice(x+12+header[1],x+12+header[1]+header[2]);
			if(unpackedSancov[module]){
				unpackedSancov[module]=Buffer.concat([unpackedSancov[module],data]);
			}else {
				unpackedSancov[module]=data;
			}
			x=x+12+header[1]+header[2];
			console.dlog('X after unpacking '+module+': '+x);
			if(x>=cf.length){
				break;
			}
		}
	}
	else{
		console.dlog('Pack length under header length.');
	}
	return unpackedSancov;
}

var currentCoverage={};
var totalBlocks=0;
var bitsetMode=true;

/*
	Check the workdir for desired .sancov files and read the .sancov files for processing.
*/
function getCoverageData(workDir){
	var coverageData={};
	var covFiles=fs.readdirSync(workDir);
	if(covFiles.length===0){
		console.dlog('WARNING: Target did not produce any .sancov file.');

	}
	for(var x=0; x<covFiles.length; x++){
		if(this.fileNameRegExp.test(covFiles[x])){
			console.dlog('Regular sancov. '+covFiles[x]);
			var module=covFiles[x].split('.')[0];
			if(coverageData[module]){
					console.dlog('Found previous entry.');
					console.dlog('Previous entry size: '+coverageData[module].length);
					coverageData[module]=Buffer.concat([coverageData[module],fs.readFileSync(workDir+'/'+covFiles[x])]);
					console.dlog('New entry size: '+coverageData[module].length);

			}else{
				coverageData[module]=fs.readFileSync(workDir+'/'+covFiles[x]);
				console.dlog('Size: '+coverageData[module].length)
			}
		}else if(this.readPacked && covFiles[x].indexOf('.sancov.packed')!=-1){
			console.dlog('Packed sancov!');
			console.dlog('Disabling bitset-mode.');
			bitsetMode=false;
			var unpackedSancov=unpackSancovPacked(workDir+'/'+covFiles[x]);
			console.dlog('Unpacked:');
			console.dlog(unpackedSancov);
			for(var y in unpackedSancov){
				console.dlog('Checking for '+ y);
				if(coverageData[y]){
					console.log('Found '+y+' from packed file');
					console.dlog('Found previous entry.');
					console.dlog('Previous entry size: '+coverageData[y].length);
					coverageData[y]=Buffer.concat([coverageData[y],unpackedSancov[y]]);
					console.log('New entry size: '+coverageData[y].length);

				}else if(!this.binaries || this.binaries.indexOf(y)!=-1){
					console.log('Found '+y+' from packed file');
					coverageData[y]=unpackedSancov[y];
				}
			}
		}
		fs.unlinkSync(workDir+'/'+covFiles[x]);
	}

	return coverageData;
}

function getCoverageHash(coverageData,hangBlacklist){
	var hash=crypto.createHash('sha1');
	var modules=Object.keys(coverageData).sort();
	var blacklist=Object.keys(hangBlacklist);
	for(var x=0; x<modules.length;x++){
		if(blacklist.indexOf(modules[x])==-1){
			console.log(modules[x]+': '+crypto.createHash('sha1').update(coverageData[modules[x]]).digest('hex'));
			hash.update(coverageData[modules[x]]);
		}
	}

	return hash.digest('hex');
}

/*
	Read coverage-data buffer and check if new coverage was found.
	NOTE: Works only for regular .sancov files.
*/
function checkCoverageBuffer(analysis,inputBuffer,module){
	var len=inputBuffer.length;
	var i=8;
	var offset=0;
	var bits=inputBuffer[0];
	var inc=4;
	if(bits==0x64)
		inc=8;
	while(i<len){
	//	if(inputBuffer.readUInt32LE(i-4)!=0)
	//		console.log('ERRORORROROROROROOOO '+inputBuffer.readUInt32LE(i-4))
		offset=inputBuffer.readUInt32LE(i);
		analysis.blocks++;
		if(currentCoverage[module][offset]===undefined){
			currentCoverage[module][offset]=0;
			analysis.keeper++;
			totalBlocks++;
		}else if(currentCoverage[module][offset]<maxBlockCount){
			analysis.keeper++;
		}
		currentCoverage[module][offset]++;
		analysis.seenAverage+=currentCoverage[module][offset];
		i+=inc;
	}
	analysis.seenAverage=analysis.seenAverage/analysis.blocks;
}

/*
	Read coverage-data buffer and check if new coverage was found.
	NOTE: Used for ASAN_OPTIONS=coverage_bitset=1.
*/
function checkBitsetBuffer(analysis,coverageData){
	if(!currentCoverage.combined){
			console.log('Initialising new bitset coverage buffer.');
			currentCoverage.combined=new Buffer(coverageData.combined.length);
			currentCoverage.combined.fill(0);
	}
	if(currentCoverage.combined.length==coverageData.combined.length){
		var covLength=currentCoverage.combined.length;
		var newCovLength=coverageData.combined.length;
		for(var x=0; x<covLength;x++){
			if(x>newCovLength)
				break;
			if(coverageData.combined[x]!=0x30){
				analysis.blocks++;
				if(currentCoverage.combined[x]===0){
					analysis.keeper++;
					totalBlocks++;
					currentCoverage.combined[x]=1;
				}else if(currentCoverage.combined[x]<maxBlockCount){
					analysis.keeper++;
				}
				currentCoverage.combined[x]++;
				analysis.seenAverage+=currentCoverage.combined[x];
			}
		}

		analysis.seenAverage=analysis.seenAverage/analysis.blocks;
	}
	else{
		console.log('Initial bitset file length differs from current.(Binary loads libraries middle of the run.)');
		console.log('Original bitset file length: '+currentCoverage.combined.length);
		console.log('Current bitset file length: '+coverageData.combined.length);
		console.log('Bailing out from bitset mode.');
		console.log('Note: Alternative method uses offset file per library/binary and is slower. All coverage data is reset.');
		totalBlocks=0;
		bitsetMode=false;
	}
}


/*
	Select correct coverage-data analyser.
*/
function isKeeper(coverageData){
	var analysis={
		keeper:0,
		blocks:0,
		seenAverage:0
	};
	if(bitsetMode && coverageData.combined){
		checkBitsetBuffer(analysis,coverageData);
	}
	else{
		for(var moduleName in coverageData){
			if(moduleName!='combined'){
				if(!currentCoverage[moduleName]){
					console.log('Collecting coverage for: '+moduleName);
					currentCoverage[moduleName]=[];
				}
				checkCoverageBuffer(analysis,coverageData[moduleName],moduleName);
			}
		}
	}
	return analysis;
}

module.exports={
	fingerPrint:asanFingerPrint,
	getCoverageData:getCoverageData,
	getCoverageHash:getCoverageHash,
	isKeeper:isKeeper,
	clearCoverage:function(){
		currentCoverage={};
		totalBlocks=0;
	},
	getTotalBlocks:function(){
		return totalBlocks;
	},
	setMaxBlockCount:function(max){
		maxBlockCount=max;
	},
	init:function(config){
		config.instrumentationHook='ERROR: AddressSanitizer';
	},
	clearWorkDir:function(workDir){
		if(workDir){
			var files=fs.readdirSync(workDir);
			files.forEach(function(file){
				if(file)
					fs.unlinkSync(path.join(workDir,file));
			});
		}
	}
};
