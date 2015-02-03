function radamsaFunction(sampleFiles,callback){
	var exec=require('child_process').exec
	exec('radamsa -n '+this.filesPerRound+' -o '+this.tempDirectory+'/samples/radamsa-%n.'+this.fileExtension+' '+(require('path').dirname(sampleFiles[0]))+'/*',callback)
}
function surkuFunction(sampleFiles,callback){
	if(!this.surku){
		var surkuConfig={
			maxMutations:20,
			minMutations:1,
			chunkSize:3000,
		}
		var S=require('surku');
		this.surku=new S(surkuConfig)
	}
	var fileCount=this.filesPerRound
	var prefix=new Date().getTime()

	while(fileCount--){
		fs.writeFileSync(this.tempDirectory+'/samples/'+prefix+fileCount+'.'+this.fileExtension,this.surku.generateTestCase(fs.readFileSync(sampleFiles[Math.floor(Math.random()*sampleFiles.length)])))
	}
	callback()
}

module.exports={
	radamsa:radamsaFunction,
	surku:surkuFunction
}